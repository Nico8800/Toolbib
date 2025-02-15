import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Info } from "lucide-react"

interface Tool {
  name: string
  description: string
  inputType: string
}

interface ToolSelectorProps {
  tools: Tool[]
  onSelect: (tool: Tool) => void
}

export function ToolSelector({ tools, onSelect }: ToolSelectorProps) {
  return (
    <div className="grid gap-4 mt-4">
      {tools.map((tool) => (
        <Card key={tool.name} className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{tool.name}</h4>
                <p className="text-sm text-muted-foreground">Need: {tool.inputType.split("/")[0]}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  View more
                </Button>
                <Button size="sm" className="flex items-center" onClick={() => onSelect(tool)}>
                  Select
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

