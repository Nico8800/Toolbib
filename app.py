from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, Literal
import uvicorn
from smolagents import Tool, CodeAgent, LiteLLMModel, DuckDuckGoSearchTool
import logging
from mistralai import Mistral
import os
import json
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import base64
from pathlib import Path
import uuid
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create upload directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Pneumonia Detection API",
    description="API for pneumonia detection using chest X-ray images",
    version="1.0.0"
)

# Mount static files directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "mistral-large-latest"
# Configuration class
class Settings:
    MODEL_API_KEY = os.getenv("MISTRAL_API_KEY")  # In production, use environment variables
    SPACE_ID = "Viraj2307/Brain-Tumor-Classification"#"vnavya2004/PNEUMONIA_DETECTION_MULTIMODEL"
    MODEL_ID = "mistral/mistral-large-latest"

settings = Settings()

brain_tumor = Tool.from_space(
    space_id=settings.SPACE_ID,
    name="brain_tumor",
    description="predicts notumor or meningioma or else",
    api_name="/predict"
)

model = LiteLLMModel(
    model_id=settings.MODEL_ID,
    api_key=settings.MODEL_API_KEY
)

# client = Mistral(api_key=os.getenv('MISTRAL_API_KEY'))

PROMPT_SYSTEM = """
    You are talking to a doctor. You are the secretary of an AI agent that can either run tools (brain tumor predictor, ...) or websearch. 
    Upon the demand of the doctor, you must decide if you need to request the AI agent.
    You know the tools available. You can suggest tools for the doctor. If the doctor select a tool explicitely, you must trigger the AI agent with the tool needed.
    You must not trigger the AI agent without the explicit demand of the doctor UNLESS it is websearch. Very important !!! Don't think too long.
    You must respond ONLY in valid JSON format matching exactly this schema:
    {
    "response": "string",
    "suggested_tool": "string" (one of provided tool or None),
    "trigger_agent" : bool,
    }
    Rules:
1. Your response must be parseable as JSON
2. All fields must match the types specified
3. Do not include any explanations or text outside the JSON structure
4. The response must be complete and well-formed JSON

Examples of valid response:

User request : "I want to check if my patient have a brain tumor."
Answer : 
{
    "response": "For sure! Do you have any data to provide ? You can use this suggested tool:",
    "suggested_tool": "brain_tumor",
    "trigger_agent" : False,
}

User request : "I want to check prohibited antibiotic for pregnant women"
Answer : 
{
    "response": "I'll search on the internet.",
    "suggested_tool": "websearch",
    "trigger_agent" : True
}

DON'T FORGET TO ANSWER ONLY IN THIS JSON FORMAT.

USER_PROMPT :
"""

class ChatRequest(BaseModel):
    message: str
    image: Optional[str] = None

class ImageUploadResponse(BaseModel):
    url: str

secretary = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

def call_secretary(request:str, image:str = None):
    image_part = f". Image: {image}" if hasattr(request, 'image') and image else ""
    chat_response = secretary.chat.complete(
    model = MODEL_NAME,
    messages = [
            {
                "role": "user",
                "content": f"{PROMPT_SYSTEM}{request}{image_part}",
            },
        ],
    response_format={
        "type" : "json_object",
    }
    
    )
    return chat_response.choices[0].message.content


agent = CodeAgent(
    tools=[brain_tumor, DuckDuckGoSearchTool()],
    model=model,
)

@app.post("/upload")
async def upload_image(image_data: dict):
    try:
        # Get base64 image data
        base64_image = image_data.get("image")
        if not base64_image:
            raise HTTPException(status_code=400, detail="No image data provided")

        # Generate unique filename
        file_extension = "jpg"  # You can add logic to determine the correct extension
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / filename

        # Decode and save the image
        image_bytes = base64.b64decode(base64_image)
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        # Return the URL where the image can be accessed
        image_url = f"http://localhost:8000/uploads/{filename}"
        return ImageUploadResponse(url=image_url)
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Main chat endpoint that processes doctor's queries and returns appropriate responses
    """
    try:
        image_part = f". Image: {request.image}" if request.image else ""
        output = call_secretary(request.message, image=request.image)
        print('Secretary', output)
        parsed_output = json.loads(output)
        if parsed_output['trigger_agent']:
            response = agent.run(
                task=f"""
            You are the AI agent. Your secretary just answered this to the doctor : {output}.
            The doctor wants : {request.message}{image_part} Interpret the results. """,
            )
            final = json.loads(
                call_secretary(request = f"{PROMPT_SYSTEM}The AI agent just answered this. Inform the doctor: {response}")
            )
            return final
        else:   
            return parsed_output 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)