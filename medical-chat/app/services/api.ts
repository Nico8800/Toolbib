import axios from 'axios';

// API service for handling backend communication
const API_BASE_URL = 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ChatRequest {
  message: string;
  image?: string;
  conversation_id?: string;
  preferred_links?: string[];
}

export interface ChatResponse {
  response: string;
  suggested_tool?: string;
  trigger_agent: boolean;
  conversation_id: string;
  sources?: string[];
}

export interface ImageUploadResponse {
  url: string;
}

export const uploadImage = async (base64Image: string): Promise<string> => {
  console.log('🚀 Starting image upload...');
  try {
    console.log('📤 Sending image data to /upload endpoint...');
    const response = await api.post<ImageUploadResponse>('/upload', {
      image: base64Image,
    });
    console.log('✅ Image upload successful, received URL:', response.data.url);
    return response.data.url;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios upload error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(error.response?.data?.detail || 'Failed to upload image');
    }
    console.error('❌ Generic upload error:', error);
    throw error;
  }
};

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  console.log('🚀 Starting chat message request...', {
    message: request.message,
    image: request.image || 'no image provided',
    preferred_links: request.preferred_links || 'no preferred links'
  });
  try {
    console.log('📤 Sending request to /chat endpoint with payload:', {
      message: request.message,
      image: request.image,
      preferred_links: request.preferred_links
    });
    const response = await api.post<ChatResponse>('/chat', request);
    console.log('✅ Chat response received:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios chat error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(error.response?.data?.detail || 'Failed to send message');
    }
    console.error('❌ Generic chat error:', error);
    throw error;
  }
}; 