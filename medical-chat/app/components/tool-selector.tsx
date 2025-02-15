import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Info, Star, Download, CheckCircle2 } from "lucide-react"

interface Tool {
  name: string
  description: string
  inputType: string
  ratings: {
    stars: number
    downloads: number
    accuracy: number
    lastUpdate: string
    verified?: boolean
  }
}

interface ToolSelectorProps {
  tools: Tool[]
  onSelect: (tool: Tool) => void
}

export function ToolSelector({ tools, onSelect }: ToolSelectorProps) {
  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div
          key={tool.name}
          onClick={() => onSelect(tool)}
          className="p-3 rounded-lg border border-gray-200 hover:border-primary/50 cursor-pointer transition-colors"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{tool.name}</h4>
                {tool.ratings.verified && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
              <p className="text-sm text-gray-600">{tool.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span>{tool.ratings.stars.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              <span>{tool.ratings.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1" title="Model Accuracy">
              <Info className="w-4 h-4" />
              <span>{(tool.ratings.accuracy * 100).toFixed(1)}%</span>
            </div>
            <div className="text-xs text-gray-400">
              Updated: {tool.ratings.lastUpdate}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

