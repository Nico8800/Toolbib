from pydantic import BaseModel
from typing import Optional, List
import logging
import os
from dotenv import load_dotenv
load_dotenv()


class ChatRequest(BaseModel):
    message: str
    image: Optional[str] = None
    conversation_id: Optional[str] = None
    preferred_links : List[str] = None

class ImageUploadResponse(BaseModel):
    url: str

class Settings:
    MODEL_API_KEY = os.getenv("MISTRAL_API_KEY")
    SPACE_ID = "Viraj2307/Brain-Tumor-Classification"
    MODEL_ID = "mistral/mistral-large-latest"
    SECRETARY_MODEL = "mistral-large-latest"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


