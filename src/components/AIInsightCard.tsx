import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertCircle, TrendingUp, Info, AlertTriangle } from "lucide-react";

interface AIInsightCardProps {
  title: string;
  type: "suggestion" | "warning" | "opportunity" | "info";
  content: string;
  confidence: number;
}

export function AIInsightCard({ title, type, content, confidence }: AIInsightCardProps) {
  const getIcon = () => {
    switch (type) {
      case "suggestion":
        return <Info className="w-5 h-5 text-blue-600" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "opportunity":
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case "info":
        return <AlertCircle className="w-5 h-5 text-purple-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case "suggestion":
        return "bg-blue-50 border-blue-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      case "opportunity":
        return "bg-green-50 border-green-200";
      case "info":
        return "bg-purple-50 border-purple-200";
    }
  };

  const getBadgeColor = () => {
    switch (type) {
      case "suggestion":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "warning":
        return "bg-amber-100 text-amber-700 hover:bg-amber-100";
      case "opportunity":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "info":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100";
    }
  };

  return (
    <Card className={`${getBackgroundColor()} border`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <Badge className={`${getBadgeColor()} text-xs`}>
            {confidence}% 신뢰도
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-700">{content}</p>
      </CardContent>
    </Card>
  );
}
