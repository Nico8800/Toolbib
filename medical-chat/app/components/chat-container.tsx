"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Send, Upload, AlertCircle, FileUp, X, Plus, Trash2, Globe, User2, Bot, Calendar, Check } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToolSelector } from "./tool-selector"
import { SourceCitation } from "./source-citation"
import Image from "next/image"
import { sendChatMessage, uploadImage } from "../services/api"
import { MarkdownContent } from "./markdown-content"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  tools?: Tool[]
  sources?: Source[]
  isThinking?: boolean
  thinkingSteps?: string[]
}

interface Tool {
  name: string
  description: string
  inputType: string
  selected?: boolean
  ratings: {
    stars: number
    downloads: number
    accuracy: number
    lastUpdate: string
    verified?: boolean
  }
}

interface Source {
  title: string
  url: string
  info: string
}

interface SourceUrl {
  id: string
  url: string
  description: string
}

interface MedicalData {
  id: string
  type: "image" | "audio"
  name: string
  description: string
  path: string
  date: string
  thumbnail?: string
}

interface RecentModel {
  id: string
  name: string
  description: string
  thumbnail: string
  lastUsed: string
  ratings: {
    stars: number
    downloads: number
    accuracy: number
    lastUpdate: string
    verified?: boolean
  }
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Tool-Bib, your medical assistant. I'm here to help you during consultations by analyzing medical images using AI models and finding reliable medical information from trusted sources.",
    }
  ])
  const [input, setInput] = useState("")
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sourceUrls, setSourceUrls] = useState<SourceUrl[]>([
    {
      id: "nhs-antibiotics",
      url: "https://www.nhs.uk/conditions/antibiotics/",
      description: "NHS official guide on antibiotics usage, side effects, and best practices"
    }
  ])
  const [newUrl, setNewUrl] = useState("")
  const [newUrlDescription, setNewUrlDescription] = useState("")
  const [showUrlForm, setShowUrlForm] = useState(false)
  const [recentModels] = useState<RecentModel[]>([
    {
      id: "brain-mri-analyzer",
      name: "Brain MRI Analyzer",
      description: "Advanced neural network for detecting brain abnormalities",
      thumbnail: "/demo-data/no_tumor.jpeg",
      lastUsed: "2024-03-15",
      ratings: {
        stars: 2847,
        downloads: 15234,
        accuracy: 0.94,
        lastUpdate: "2024-02",
        verified: true
      }
    },
    {
      id: "chest-xray-analyzer",
      name: "Chest X-Ray Analyzer",
      description: "AI-powered pneumonia detection system",
      thumbnail: "/demo-data/pneumonia.jpeg",
      lastUsed: "2024-03-14",
      ratings: {
        stars: 1923,
        downloads: 8756,
        accuracy: 0.91,
        lastUpdate: "2024-03",
        verified: true
      }
    }
  ])

  const addThinkingStep = (step: string) => {
    setThinkingSteps(prev => [...prev, step])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsThinking(true)
    setThinkingSteps([])

    // Add initial thinking message
    const thinkingMessage: Message = {
      id: Date.now().toString() + "-thinking",
      role: "assistant",
      content: "",
      isThinking: true,
      thinkingSteps: []
    }
    setMessages(prev => [...prev, thinkingMessage])

    try {
      // Simulate thinking steps
      const steps = [
        "Understanding your medical query...",
        "Checking available tools and resources...",
        "Analyzing context and requirements...",
        "Preparing personalized response..."
      ]

      // Add thinking steps with delays
      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 800))
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage.isThinking) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                thinkingSteps: [...(lastMessage.thinkingSteps || []), step]
              }
            ]
          }
          return prev
        })
      }

      // Call the backend API with conversation ID
      const response = await sendChatMessage({
        message: input,
        image: previewUrl || undefined,
        conversation_id: conversationId,
        preferred_links: sourceUrls.map(source => source.url)
      })

      // Store the conversation ID for future messages
      if (response.conversation_id) {
        setConversationId(response.conversation_id)
      }

      // Remove thinking message and add final response
      setMessages(prev => prev.filter(msg => !msg.isThinking))
      
      // Create assistant message from response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        role: "assistant",
      }

      // If there's a suggested tool, add it to the message
      if (response.suggested_tool === "brain_tumor") {
        assistantMessage.tools = [{
          name: "Brain MRI Analyzer",
          description: "Advanced neural network for detecting brain abnormalities in MRI scans",
          inputType: "image/*",
          ratings: {
            stars: 2847,
            downloads: 15234,
            accuracy: 0.94,
            lastUpdate: "2024-02",
            verified: true
          }
        }]
      }

      // Add sources if they exist in the response
      if (response.sources && response.sources.length > 0) {
        assistantMessage.sources = response.sources.map(url => ({
          title: new URL(url).hostname,
          url: url,
          info: "Referenced source"
        }))
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove thinking message
      setMessages(prev => prev.filter(msg => !msg.isThinking))
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, there was an error processing your request. Please try again.",
        role: "assistant",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsThinking(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploadError(null)
    setIsUploading(true)
    setPreviewUrl(null)

    try {
      // Validate file type based on selected tool
      const allowedTypes = selectedTool?.inputType.split(',') || []
      const fileType = file.type.split('/')[0]
      const expectedType = selectedTool?.inputType.split('/')[0]

      if (fileType !== expectedType) {
        throw new Error(`Invalid file type. Expected ${expectedType} file.`)
      }

      // For image files, create and set preview
      if (fileType === 'image') {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64Image = e.target?.result as string
          setPreviewUrl(base64Image)

          try {
            // Add a success message to the chat
            const uploadSuccessMessage: Message = {
              id: Date.now().toString(),
              content: `File uploaded successfully. Preparing to analyze with ${selectedTool?.name}...`,
              role: "assistant",
            }
            setMessages(prev => [...prev, uploadSuccessMessage])
          } catch (error) {
            console.error('Analysis error:', error)
            setUploadError('Failed to analyze the image')
          }
        }
        reader.readAsDataURL(file)
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      console.error('Upload error:', error)
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    // Check if it's a data drop from our side window
    const jsonData = e.dataTransfer.getData('application/json')
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData) as MedicalData
        if (selectedTool) {
          setIsUploading(true)
          handleDataDrop(data)
        }
        return
      } catch (error) {
        console.error('Failed to parse dropped data:', error)
      }
    }

    // If not a data drop, check if it's a file drop
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [selectedTool])

  const clearPreview = () => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRunAnalysis = async () => {
    console.log('🔄 Run Analysis button clicked');
    
    if (!selectedTool) {
      console.warn('⚠️ No tool selected');
      return;
    }
    
    if (!previewUrl) {
      console.warn('⚠️ No image preview available');
      return;
    }

    // Store tool name for the message
    const toolName = selectedTool.name;

    // Close the upload interface immediately
    setSelectedTool(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    console.log('🔍 Starting analysis with:', {
      tool: toolName,
      imageUrl: previewUrl
    });

    try {
      // Add a thinking message with steps
      const thinkingMessage: Message = {
        id: Date.now().toString(),
        content: "",
        role: "assistant",
        isThinking: true,
        thinkingSteps: []
      }
      setMessages(prev => [...prev, thinkingMessage])

      // Add thinking steps with delays
      const analysisSteps = [
        "Preprocessing medical image...",
        "Applying advanced AI algorithms...",
        "Analyzing patterns and anomalies...",
        "Generating detailed medical insights...",
      ]

      for (const step of analysisSteps) {
        await new Promise(resolve => setTimeout(resolve, 800))
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage.isThinking) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                thinkingSteps: [...(lastMessage.thinkingSteps || []), step]
              }
            ]
          }
          return prev
        })
      }

      // Send the base64 image data directly to the chat endpoint
      console.log('📤 Sending analysis request with image data');
      const response = await sendChatMessage({
        message: `Please analyze this image using the brain_tumor tool`,
        image: previewUrl,  // This is now the base64 data
        conversation_id: conversationId,
        preferred_links: sourceUrls.map(source => source.url)
      })
      console.log('✅ Received analysis response:', response);

      // Store the conversation ID if it's new
      if (response.conversation_id) {
        setConversationId(response.conversation_id)
      }

      // Remove thinking message
      setMessages(prev => prev.filter(msg => !msg.isThinking))

      // Add the analysis result to messages
      const botResponse: Message = {
        id: Date.now().toString(),
        content: response.response,
        role: "assistant",
      }
      
      console.log('💬 Adding analysis result to chat');
      setMessages(prev => [...prev, botResponse])

      // Clear the preview
      setPreviewUrl(null)
      console.log('✨ Analysis workflow completed');
    } catch (error) {
      console.error('❌ Analysis error:', error)
      // Remove thinking message
      setMessages(prev => prev.filter(msg => !msg.isThinking))
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "Sorry, there was an error analyzing the image. Please try again.",
        role: "assistant",
      }
      console.log('💬 Adding error message to chat');
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const addSourceUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim()) return

    const newSourceUrl: SourceUrl = {
      id: Date.now().toString(),
      url: newUrl.trim(),
      description: newUrlDescription.trim() || "No description"
    }

    setSourceUrls(prev => [...prev, newSourceUrl])
    setNewUrl("")
    setNewUrlDescription("")
    setShowUrlForm(false)
  }

  const removeSourceUrl = (id: string) => {
    setSourceUrls(prev => prev.filter(url => url.id !== id))
  }

  const cancelToolSelection = () => {
    setSelectedTool(null)
    setPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDataDrop = async (data: MedicalData) => {
    try {
      if (selectedTool) {
        const expectedType = selectedTool.inputType.split('/')[0]
        if (data.type === expectedType) {
          // Set the preview URL directly from the data path
          setPreviewUrl(data.path)
          
          // Add success message for data drops
          const uploadSuccessMessage: Message = {
            id: Date.now().toString(),
            content: `${data.name} loaded successfully. Preparing to analyze with ${selectedTool.name}...`,
            role: "assistant",
          }
          setMessages(prev => [...prev, uploadSuccessMessage])

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Simulate API response based on selected tool and data
          let mockResult = {
            prediction: "Analysis not available for this tool"
          }

          if (selectedTool.name === "Brain MRI Analyzer" && data.name.includes("Brain MRI")) {
            mockResult.prediction = "No significant abnormalities detected. Confidence score: 92%"
          } else if (selectedTool.name === "Chest X-Ray Analyzer" && data.name.includes("Chest X-Ray")) {
            mockResult.prediction = "Mild signs of pneumonia detected in lower right lobe. Confidence score: 89%"
          }
          
          // Add the analysis result to messages
          const botResponse: Message = {
            id: Date.now().toString(),
            content: `Analysis complete: ${mockResult.prediction}`,
            role: "assistant",
          }
          
          setMessages(prev => [...prev, botResponse])
        } else {
          setUploadError(`Invalid file type. Expected ${expectedType} file.`)
        }
      }
    } catch (error) {
      setUploadError('Failed to process the dropped data')
      console.error('Data drop error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ffffff]">
      <div className="container mx-auto p-2 max-w-[98%]">
        <div className="flex items-start justify-between mb-8 px-4">
          <div className="flex items-center gap-6">
            <div className="relative w-[160px] h-[160px] bg-[#ffffff]">
              <Image
                src="/logo-png.png"
                alt="TOOL-BIB Logo"
                width={160}
                height={160}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col items-start">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent">
                Tool-Bib
              </h1>
              <p className="text-base text-gray-600 mt-2 max-w-md">
                Easy access to the best open-source models to help you during consultations
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="h-[600px] flex-1 flex flex-col bg-[#ffffff] rounded-xl">
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 ${
                      message.role === "user" 
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground ml-auto" 
                        : "bg-gray-50 border border-gray-100 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-70">
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>
                    <div className={message.role === "user" ? "text-[15px] leading-relaxed" : ""}>
                      {message.role === "user" ? (
                        <p>{message.content}</p>
                      ) : (
                        <MarkdownContent content={message.content} />
                      )}
                    </div>
                    {message.isThinking && message.thinkingSteps && message.thinkingSteps.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.thinkingSteps.map((step, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-gray-500 animate-fadeIn"
                            style={{
                              animationDelay: `${index * 100}ms`,
                              opacity: 0,
                            }}
                          >
                            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            </div>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.tools && (
                      <div className="mt-4 pt-4 border-t border-gray-200/10">
                        <ToolSelector 
                          tools={message.tools} 
                          onSelect={(tool) => setSelectedTool(tool)} 
                        />
                      </div>
                    )}
                    {message.sources && (
                      <div className="mt-4 bg-white/95 rounded-lg p-3 shadow-sm">
                        <SourceCitation sources={message.sources} />
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter className="border-t p-4 bg-gray-50">
              {selectedTool ? (
                <div className="flex flex-col w-full gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept={selectedTool.inputType}
                    className="hidden"
                  />
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-700">
                      Upload file for {selectedTool.name}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelToolSelection}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {!previewUrl ? (
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                        isDragging 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:border-primary/50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <FileUp className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
                        <div className="text-sm">
                          <p className="font-medium">
                            Drop your {selectedTool.inputType.split("/")[0]} here or
                          </p>
                          <button
                            type="button"
                            onClick={triggerFileUpload}
                            className="text-primary hover:underline"
                          >
                            click to browse
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Supported format: {selectedTool.inputType}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-48 object-contain bg-black/5"
                      />
                      <button
                        onClick={clearPreview}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 h-11 bg-primary hover:bg-primary/90"
                      onClick={handleRunAnalysis}
                      disabled={isUploading || !previewUrl}
                    >
                      Run Analysis
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={cancelToolSelection}
                    >
                      Cancel
                    </Button>
                  </div>
                  {uploadError && (
                    <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
                      <AlertCircle className="w-4 h-4" />
                      {uploadError}
                    </div>
                  )}
                  {isUploading && (
                    <div className="flex items-center gap-2 text-primary text-sm">
                      <div className="animate-spin">
                        <Upload className="w-4 h-4" />
                      </div>
                      Uploading...
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex w-full gap-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your medical query or upload patient data for analysis..."
                    className="flex-1 h-11 bg-white border-gray-200 focus:border-primary"
                  />
                  <Button 
                    type="submit" 
                    className="h-11 px-6 bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </CardFooter>
          </Card>
          
          {/* Right sidebar with stacked cards */}
          <div className="w-80 flex flex-col gap-4">
            <Card className="h-[350px] bg-[#ffffff] rounded-xl flex flex-col">
              <CardHeader className="border-b p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Recently Used Models</h3>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {recentModels.map((model) => (
                    <div
                      key={model.id}
                      className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                          <Image
                            src={model.thumbnail}
                            alt={model.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1">{model.name}</h4>
                          <p className="text-xs text-gray-500 mb-2">{model.description}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center text-yellow-500">
                              <span className="font-medium">{model.ratings.accuracy * 100}%</span>
                            </div>
                            <span className="text-gray-300">•</span>
                            <div className="text-gray-400">
                              {model.ratings.downloads.toLocaleString()} uses
                            </div>
                            {model.ratings.verified && (
                              <>
                                <span className="text-gray-300">•</span>
                                <div className="text-emerald-500 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Verified</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-[230px] bg-[#ffffff] rounded-xl flex flex-col">
              <CardHeader className="border-b p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">My Trusted Sources</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUrlForm(true)}
                    className="h-8 px-2"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                {showUrlForm && (
                  <form onSubmit={addSourceUrl} className="mb-4 space-y-3 p-3 bg-gray-50 rounded-lg">
                    <Input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="Enter URL..."
                      type="url"
                      className="h-9"
                      required
                    />
                    <Input
                      value={newUrlDescription}
                      onChange={(e) => setNewUrlDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="flex-1 h-8">
                        Add
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowUrlForm(false)}
                        className="flex-1 h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
                <div className="space-y-2">
                  {sourceUrls.map((source) => (
                    <div 
                      key={source.id} 
                      className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-primary mb-1">
                            <Globe className="w-3 h-3" />
                            <span className="truncate">{new URL(source.url).hostname}</span>
                          </div>
                          <p className="text-xs text-gray-500 break-words">
                            {source.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSourceUrl(source.id)}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
