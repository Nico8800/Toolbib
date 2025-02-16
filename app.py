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
import requests
from PIL import Image
from io import BytesIO
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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],  # Add your frontend URLs
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
    conversation_id: Optional[str] = None

class ImageUploadResponse(BaseModel):
    url: str

secretary = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

# Store conversations in memory (in production, use a proper database)
conversations = {}

def get_or_create_conversation(conversation_id: Optional[str] = None) -> tuple[str, list]:
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    return conversation_id, conversations[conversation_id]

def call_secretary(request: str, image: str = None, conversation_history: list = None):
    # Add image context to the system prompt if an image is provided
    modified_prompt = PROMPT_SYSTEM
    if image:
        modified_prompt = PROMPT_SYSTEM.replace(
            "You are talking to a doctor.",
            "You are talking to a doctor. The doctor has provided an image for analysis."
        )
    
    image_part = f". Image URL: {image}" if image else ""
    user_input = f"{modified_prompt}{request}{image_part}"
    
    # Prepare messages with conversation history
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
    
    # Add the current user message
    messages.append({
        "role": "user",
        "content": user_input,
    })
    
    chat_response = secretary.chat.complete(
        model=MODEL_NAME,
        messages=messages,
        response_format={
            "type": "json_object",
        }
    )
    
    # Parse the response
    response_content = chat_response.choices[0].message.content
    response_json = json.loads(response_content)
       
    return json.dumps(response_json)

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
        # Get or create conversation history
        conversation_id, history = get_or_create_conversation(request.conversation_id)
        print('Request', request)

        # Handle image if provided
        temp_image_path = None
        if request.image:
            try:
                # Extract base64 data (remove data:image/jpeg;base64, prefix if present)
                image_data = request.image
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                # Decode base64 to bytes
                image_bytes = base64.b64decode(image_data)
                
                # Create a temporary file
                temp_image_path = UPLOAD_DIR / f"temp_{uuid.uuid4()}.jpg"
                with open(temp_image_path, "wb") as f:
                    f.write(image_bytes)
                
                print(f'Created temporary image at: {temp_image_path}')
            except Exception as e:
                logger.error(f"Error processing image: {str(e)}")
                if temp_image_path and temp_image_path.exists():
                    temp_image_path.unlink()
                raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

        # Add user message to history
        history.append({
            "role": "user",
            "content": request.message
        })
        
        # Get secretary response with history
        output = call_secretary(request.message, image=str(temp_image_path) if temp_image_path else None, conversation_history=history)
        print('Secretary', output)
        parsed_output = json.loads(output)
        print('Parsed output', parsed_output)

        # Add secretary response to history
        history.append({
            "role": "assistant",
            "content": parsed_output["response"]
        })
        
        if parsed_output['trigger_agent']:
            print('Agent running')
            # If we have an image and it's a brain tumor analysis
                # Run agent with full context for non-image queries
            print('Agent running')
            response = agent.run(
                task=f"""
                You are the AI agent. Your secretary just answered this to the doctor: {output}.
                The doctor wants: {request.message}
                Previous conversation context: {json.dumps(history)}
                Image: {str(temp_image_path) if temp_image_path else 'No image provided'}
                Interpret the results considering the full conversation context.
                """,
            )
            
            print('Agent response', response)
            # Get final secretary response
            final = json.loads(
                call_secretary(
                    request=f"{PROMPT_SYSTEM}The AI agent just answered this. Inform the doctor: {response}",
                    conversation_history=history
                )
            )
            print('Final response', final)
            # Add final response to history
            history.append({
                "role": "assistant",
                "content": final["response"]
            })
            
            # Clean up temporary file
            if temp_image_path and temp_image_path.exists():
                temp_image_path.unlink()
            
            # Return response with conversation ID
            return {**final, "conversation_id": conversation_id}
        else:
            # Clean up temporary file if not used
            if temp_image_path and temp_image_path.exists():
                temp_image_path.unlink()
            
            # Return response with conversation ID
            return {**parsed_output, "conversation_id": conversation_id}
    except Exception as e:
        # Clean up temporary file in case of error
        if temp_image_path and temp_image_path.exists():
            temp_image_path.unlink()
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)