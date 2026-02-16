import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import LatexRenderer from '@/components/ui/LatexRenderer.jsx';
import { Lightbulb } from 'lucide-react';

const ExplanationCard = ({ explanation }) => {
  if (!explanation) return null;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex gap-3">
          <Lightbulb className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 mb-2 text-sm md:text-base dark:text-blue-200">
              Explanation:
            </p>
            <div className="text-sm text-blue-800 leading-relaxed dark:text-blue-200">
              <LatexRenderer content={explanation} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExplanationCard;