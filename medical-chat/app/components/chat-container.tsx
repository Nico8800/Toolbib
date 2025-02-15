"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Send, Upload, AlertCircle, FileUp, X, Plus, Trash2, Globe, User2, Bot } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToolSelector } from "./tool-selector"
import { SourceCitation } from "./source-citation"
import Image from "next/image"

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

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sourceUrls, setSourceUrls] = useState<SourceUrl[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [newUrlDescription, setNewUrlDescription] = useState("")
  const [showUrlForm, setShowUrlForm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
    }

    setMessages((prev) => [...prev, newMessage])
    setInput("")

    // TODO: In the real implementation, you would:
    // 1. Send both the user's query and sourceUrls to your backend
    // 2. Have the backend fetch and analyze content from these URLs
    // 3. Return a summarized response with relevant information
    
    setTimeout(() => {
      let botResponse: Message
      if (input.toLowerCase().includes("alzheimer")) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          content: "You can use these models:",
          role: "assistant",
          tools: [
            {
              name: "MRI Alzheimer predictor",
              description: "Upload MRI scan to predict Alzheimer's probability",
              inputType: "image/*",
            },
            {
              name: "Brain damage Analyzer",
              description: "Analyze speech patterns for cognitive assessment",
              inputType: "audio/*",
            },
          ],
        }
      } else if (input.toLowerCase().includes("antibiotics")) {
        if (sourceUrls.length === 0) {
          botResponse = {
            id: (Date.now() + 1).toString(),
            content: "Please add some medical reference URLs in the side panel first. This will help me provide information from your trusted sources.",
            role: "assistant",
          }
        } else {
          // Example of how the real implementation would structure the data
          const exampleFindings: { [key: string]: string } = {
            "www.medical-journal.com": "Antibiotics should be prescribed based on bacterial culture results.",
            "www.health-research.org": "Common side effects include gastrointestinal disturbance.",
            "www.clinical-guidelines.net": "Duration of treatment typically ranges from 7-14 days."
          }

          botResponse = {
            id: (Date.now() + 1).toString(),
            content: "Here's what I found about antibiotics from your trusted sources:",
            role: "assistant",
            sources: sourceUrls.map(url => {
              const hostname = new URL(url.url).hostname
              return {
                title: "Antibiotic Guidelines and Usage",  // This would be extracted from the actual page title
                url: url.url,
                info: exampleFindings[hostname] || `Key findings about antibiotics would be extracted from ${url.description || hostname}`,
              }
            }),
          }
        }
      } else {
        botResponse = {
          id: (Date.now() + 1).toString(),
          content: "How can I assist you with your medical query?",
          role: "assistant",
        }
      }
      setMessages((prev) => [...prev, botResponse])
    }, 1000)
  }

  const handleFileUpload = async (file: File) => {
    setUploadError(null)
    setIsUploading(true)
    setPreviewUrl(null)

    try {
      // Validate file type based on selected tool
      const allowedTypes = selectedTool?.inputType.split(',') || []
      const fileType = file.type.split('/')[0] // Get the main type (image, audio, etc.)
      const expectedType = selectedTool?.inputType.split('/')[0]

      if (fileType !== expectedType) {
        throw new Error(`Invalid file type. Expected ${expectedType} file.`)
      }

      // For image files, create and set preview
      if (fileType === 'image') {
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }

      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', selectedTool?.name || '')

      // TODO: Replace with your actual API endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      
      // Add the analysis result to messages
      const botResponse: Message = {
        id: Date.now().toString(),
        content: `Analysis complete: ${result.prediction}`,
        role: "assistant",
      }
      
      setMessages(prev => [...prev, botResponse])
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

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const clearPreview = () => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // TODO: Implement tool execution
  // This function will be called when the "Run Analysis" button is clicked
  const handleRunAnalysis = () => {
    if (selectedTool) {
      // Implement the logic to run the selected tool
      console.log("Running analysis with tool:", selectedTool.name)
      // You'll need to send a request to your backend to execute the tool
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
            TOOL-BIB
          </h1>
        </div>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Access the best open-source models to help you during consultations
        </p>
      </div>
      <div className="flex gap-4">
        <Card className="h-[700px] flex-1 flex flex-col bg-white shadow-lg rounded-xl">
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
                <Button 
                  className="h-11 bg-primary hover:bg-primary/90"
                  onClick={handleRunAnalysis}
                  disabled={isUploading || !previewUrl}
                >
                  Run Analysis
                </Button>
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
        <Card className="w-80 h-[700px] bg-white shadow-lg rounded-xl flex flex-col">
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
  )
}

