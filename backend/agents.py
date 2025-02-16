
from typing import Optional, List
from smolagents import Tool, CodeAgent, LiteLLMModel
import logging
from mistralai import Mistral
import os
from dotenv import load_dotenv
load_dotenv()
from utils import Settings


class DuckDuckGoSearchTool(Tool):
    name = "web_search"
    description = (
        "Performs a DuckDuckGo web search based on your query and returns the top search results. "
        "Optionally, if the external user provides an array of website domains, the search will be "
        "restricted to (or prioritize) those sites."
    )
    inputs = {
        "query": {"type": "string", "description": "The search query to perform."},
        "prioritize_websites": {
            "type": "array",  # Use 'array' as the authorized type.
            "description": "Optionally, an array of website domains to restrict the search. "
                           "Only used if provided by the external user.",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, max_results: int = 10, **kwargs):
        super().__init__()
        self.max_results = max_results
        try:
            from duckduckgo_search import DDGS
        except ImportError as e:
            raise ImportError(
                "You must install package `duckduckgo_search` to run this tool: "
                "for instance run `pip install duckduckgo-search`."
            ) from e
        self.ddgs = DDGS(**kwargs)

    def forward(self, query: str, prioritize_websites: Optional[List[str]] = None) -> str:
        # Only modify the query if the external user provides a non-empty list.
        if prioritize_websites:
            sites_str = " OR ".join([f"site:{site}" for site in prioritize_websites])
            query = f"{query} ({sites_str})"
        
        results = self.ddgs.text(query, max_results=self.max_results)
        if len(results) == 0:
            raise Exception("No results found! Try a less restrictive/shorter query.")

        postprocessed_results = [
            f"[{result['title']}]({result['href']})\n{result['body']}" for result in results
        ]
        return "## Search Results\n\n" + "\n\n".join(postprocessed_results)

settings = Settings()

brain_tumor = Tool.from_space(
    space_id=settings.SPACE_ID,
    name="brain_tumor",
    description="predicts notumor or meningioma or else",
    api_name="/predict"
)

model = LiteLLMModel(
    model_id="mistral/mistral-large-latest",
    api_key=os.getenv('MISTRAL_API_KEY')
)
print(model)
secretary = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

agent = CodeAgent(
    tools=[brain_tumor, DuckDuckGoSearchTool(max_results=5)],
    model=model,
    max_steps=3
)
