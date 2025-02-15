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
}

export interface ChatResponse {
  response: string;
  suggested_tool?: string;
  trigger_agent: boolean;
}

export interface ImageUploadResponse {
  url: string;
}

export const uploadImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await api.post<ImageUploadResponse>('/upload', {
      image: base64Image,
    });
    return response.data.url;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to upload image');
    }
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const response = await api.post<ChatResponse>('/chat', request);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to send message');
    }
    console.error('Error sending chat message:', error);
    throw error;
  }
}; 