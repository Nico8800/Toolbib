"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Send, Upload, AlertCircle, FileUp, X, Plus, Trash2, Globe, User2, Bot, Calendar } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToolSelector } from "./tool-selector"
import { SourceCitation } from "./source-citation"
import Image from "next/image"
import { sendChatMessage, uploadImage } from "../services/api"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  tools?: Tool[]
  sources?: Source[]
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

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
  const [medicalData] = useState<MedicalData[]>([
    {
      id: "demo-brain-mri",
      type: "image",
      name: "Brain MRI Scan",
      description: "T1-weighted MRI scan",
      path: "/demo-data/no_tumor.jpeg",
      date: "2024-03-15"
    },
    {
      id: "demo-chest-xray",
      type: "image",
      name: "Chest X-Ray",
      description: "PA view chest radiograph",
      path: "/demo-data/pneumonia.jpeg",
      date: "2024-03-14"
    }
  ])

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

    try {
      // Call the backend API
      const response = await sendChatMessage({
        message: input,
        image: previewUrl || undefined,
      })

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
      } else if (response.suggested_tool === "websearch") {
        // Handle websearch case if needed
        assistantMessage.content += "\n\nI'll search through your trusted sources for relevant information."
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, there was an error processing your request. Please try again.",
        role: "assistant",
      }
      setMessages((prev) => [...prev, errorMessage])
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
            // First upload the image to get a URL
            const imageUrl = await uploadImage(base64Image.split(',')[1])

            // Add a success message to the chat
            const uploadSuccessMessage: Message = {
              id: Date.now().toString(),
              content: `File uploaded successfully. Preparing to analyze with ${selectedTool?.name}...`,
              role: "assistant",
            }
            setMessages(prev => [...prev, uploadSuccessMessage])

            // Send the image URL to the chat endpoint
            const response = await sendChatMessage({
              message: "Analyze this brain scan",
              image: imageUrl,
            })

            // Add the analysis result to messages
            const botResponse: Message = {
              id: Date.now().toString(),
              content: response.response,
              role: "assistant",
            }
            
            setMessages(prev => [...prev, botResponse])
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
    if (selectedTool && previewUrl) {
      try {
        // Add a loading message
        const loadingMessage: Message = {
          id: Date.now().toString(),
          content: `Starting analysis with ${selectedTool.name}...`,
          role: "assistant",
        }
        setMessages(prev => [...prev, loadingMessage])

        // Send the image URL to the chat endpoint
        const response = await sendChatMessage({
          message: "Analyze this brain scan",
          image: previewUrl,
        })

        // Add the analysis result to messages
        const botResponse: Message = {
          id: Date.now().toString(),
          content: response.response,
          role: "assistant",
        }
        
        setMessages(prev => [...prev, botResponse])

        // Clear the tool selection and preview after analysis
        setSelectedTool(null)
        setPreviewUrl(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error) {
        console.error('Analysis error:', error)
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: "Sorry, there was an error analyzing the image. Please try again.",
          role: "assistant",
        }
        setMessages(prev => [...prev, errorMessage])
      }
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
    <div className="container mx-auto max-w-6xl p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Image
            src="/logo.jpg"
            alt="TOOL-BIB Logo"
            width={100}
            height={100}
            className="rounded-lg shadow-sm"
            priority
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent">
            Tool-Bib
          </h1>
        </div>
        <p className="text-base italic text-gray-600 max-w-md mx-auto">
          Easy access to the best open-source models to help you during consultations
        </p>
      </div>
      <div className="flex gap-4">
        <Card className="h-[600px] flex-1 flex flex-col bg-white shadow-lg rounded-xl">
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
                  <p className="text-[15px] leading-relaxed">{message.content}</p>
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
          <Card className="h-[290px] bg-white shadow-lg rounded-xl flex flex-col">
            <CardHeader className="border-b p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Patient Data</h3>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {medicalData.map((data) => (
                  <div
                    key={data.id}
                    className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                        <Image
                          src={data.path}
                          alt={data.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1">{data.name}</h4>
                        <p className="text-xs text-gray-500 mb-1">{data.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{data.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="h-[290px] bg-white shadow-lg rounded-xl flex flex-col">
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
  )
}
