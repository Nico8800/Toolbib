import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"

interface Source {
  title: string
  url: string
  info: string
}

interface SourceCitationProps {
  sources: Source[]
}

export function SourceCitation({ sources }: SourceCitationProps) {
  return (
    <div className="grid gap-4 mt-4">
      {sources.map((source, index) => (
        <Card key={index} className="bg-card">
          <CardContent className="p-4">
            <p className="text-sm mb-2">{source.info}</p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary hover:underline"
            >
              <span className="text-xs">{source.title}</span>
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

