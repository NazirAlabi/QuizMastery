import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { AlertCircle } from 'lucide-react';

const WeaknessCard = ({ topic, accuracy }) => {
  return (
    <Card className="border-amber-200 bg-amber-50 w-full dark:bg-amber-950/30 dark:border-amber-900">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm md:text-base truncate dark:text-slate-100">{topic}</p>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
              {accuracy}% accuracy - needs improvement
            </p>
          </div>
          <div className="text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-500">
            {accuracy}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeaknessCard;