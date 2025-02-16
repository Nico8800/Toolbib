from fastapi import FastAPI, HTTPException
from typing import Optional
import uvicorn
import json
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import base64
from pathlib import Path
import uuid
load_dotenv()
from utils import *
from prompts import PROMPT_SYSTEM

from agents import agent, model, secretary, settings


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Pneumonia Detection API",
    description="API for pneumonia detection using chest X-ray images",
    version="1.0.0"
)

# # Mount static files directory
# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000",
#         "http://localhost:3001",
#         "http://127.0.0.1:3000",
#         "http://127.0.0.1:3001"
#     ],  # Add your frontend URLs
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

def get_or_create_conversation(conversation_id: Optional[str] = None) -> tuple[str, list]:
    conversations = {}
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
        model=settings.SECRETARY_MODEL,
        messages=messages,
        response_format={
            "type": "json_object",
        }
    )
    
    # Parse the response
    response_content = chat_response.choices[0].message.content
    response_json = json.loads(response_content)
       
    return json.dumps(response_json)

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
            response = agent.run(
                task=f"""
                You are the AI agent. Your secretary just answered this to the doctor: {output}.
                The doctor wants: {request.message}
                Preferred sources : {request.preferred_links}
                Previous conversation context: {json.dumps(history)}
                Image: {str(temp_image_path) if temp_image_path else 'No image provided'}
                If you use web search, you must explicitely give the links you found.
                Interpret the results considering the full conversation context.
                If you are using websearch, PLEASE CITE YOUR SOURCES !!!
                """,
            )
            
            print('Agent response', response)
            # Get final secretary response

            if parsed_output['suggested_tool'] == 'websearch':
                final = json.loads(
                    call_secretary(
                        request=f"The AI agent just answered this. Inform the doctor: {response} and explicitly give the links the agent used as sources.Please mention again 'suggested_tool'='web_search'",
                        conversation_history=history
                    )
                )
            else:
                final = json.loads(
                    call_secretary(
                        request=f"{PROMPT_SYSTEM}The AI agent just answered this. Inform the doctor: {response}. Please mention again the tool used in `suggested_tool`",
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