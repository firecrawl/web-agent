"""Use Firecrawl Agent as a LangChain tool."""

import os
import requests
from langchain.tools import Tool
from langchain.agents import initialize_agent, AgentType
from langchain_openai import ChatOpenAI

AGENT_URL = os.environ.get("AGENT_URL", "http://localhost:3000/api/v1")


def run_firecrawl_agent(prompt: str) -> str:
    """Send a prompt to the Firecrawl Agent and return the result."""
    resp = requests.post(
        f"{AGENT_URL}/run",
        json={"prompt": prompt},
        timeout=120,
    )
    resp.raise_for_status()
    return str(resp.json())


firecrawl_tool = Tool(
    name="firecrawl_agent",
    func=run_firecrawl_agent,
    description=(
        "Scrape, search, and extract structured data from the web. "
        "Pass a natural-language prompt describing what you need."
    ),
)

llm = ChatOpenAI(model="gpt-4o", temperature=0)
agent = initialize_agent(
    tools=[firecrawl_tool],
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True,
)

if __name__ == "__main__":
    result = agent.run(
        "Find the top 3 trending repositories on GitHub today "
        "and return their name, author, and star count."
    )
    print(result)
