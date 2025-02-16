from typing import Optional
from smolagents import CodeAgent, GoogleSearchTool, HfApiModel
from smolagents import HfApiModel, LiteLLMModel, TransformersModel, tool
from smolagents.agents import CodeAgent, ToolCallingAgent
# Initialize a model (this uses a default inference provider via HfApiModel).
model = LiteLLMModel(
    model_id="mistral/mistral-small-latest",
    api_key="",  # replace with API key if necessary
)


# Create an agent with an internet search tool (DuckDuckGo).
agent = CodeAgent(
    tools=[GoogleSearchTool()],
    model=model
)

# Define a health-related query.
query = (
    "What are the common symptoms of type 2 diabetes? "
    "Please provide information from reliable health sources."
)
print("Query:", query)

# Run the agent; it will use its code-writing abilities to perform a web search
# and gather information.
result = agent.run(query)

print("\nAgent result:")
print(result)
