import json
import logging
from httpx import HTTPStatusError

from app.config import GITHUB_FILE_MAX_CHARS

from app.services.github import search_repos, search_files, get_file_content

logger = logging.getLogger(__name__)

# Strict JSON schemas compatible with OpenAI's function calling API
GITHUB_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_github_repositories",
            "description": "Search GitHub repositories to find open-source tools and libraries. Returns top 5 repositories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for repositories (e.g., 'rate limiting python')"
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_github_files",
            "description": "Search for files within a specific GitHub repository. Returns top 5 files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner (e.g., 'pallets')"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name (e.g., 'flask')"
                    },
                    "query": {
                        "type": "string",
                        "description": "Search query for filenames"
                    },
                },
                "required": ["owner", "repo", "query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_github_file_content",
            "description": "Read the contents of a single file from a GitHub repository, useful for reading README.md or specific source files. Will return at most 5000 characters to save context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "path": {
                        "type": "string",
                        "description": "File path within the repository"
                    },
                },
                "required": ["owner", "repo", "path"],
            },
        },
    },
]

async def execute_github_tool(name: str, arguments_json: str) -> str:
    """
    Execute a GitHub tool by name with JSON arguments and return a string result.
    Includes robust error and rate-limit handling for production use.
    """
    try:
        args = json.loads(arguments_json)
        logger.info(f"Executing tool {name} with args {args}")
        
        if name == "search_github_repositories":
            results = await search_repos(args.get("query", ""), per_page=5)
            # Make the output compact for the LLM
            return json.dumps([
                {"name": r["full_name"], "desc": r.get("description"), "stars": r["stars"]}
                for r in results
            ])
            
        elif name == "search_github_files":
            results = await search_files(args.get("owner", ""), args.get("repo", ""), args.get("query", ""), per_page=5)
            return json.dumps([{"path": r["path"]} for r in results])
            
        elif name == "get_github_file_content":
            result = await get_file_content(args.get("owner", ""), args.get("repo", ""), args.get("path", ""))
            content = result.get("content", "")
            
            # Context window protection: truncate extremely large files
            if len(content) > GITHUB_FILE_MAX_CHARS:
                content = content[:GITHUB_FILE_MAX_CHARS] + f"\n... [Truncated, original size: {len(content)} chars]"
            return content
            
        else:
            return f"Error: Unknown tool '{name}'"
            
    except HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code == 403 or status_code == 429:
            return "Error: GitHub API rate limit exceeded or access forbidden."
        elif status_code == 404:
            return "Error: Repository or file not found."
        return f"GitHub API Error: HTTP {status_code}"
    except Exception as e:
        logger.exception(f"Error executing tool {name}")
        return f"Error executing tool: {str(e)}"
