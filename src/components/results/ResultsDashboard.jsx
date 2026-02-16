import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import WeaknessCard from '@/components/results/WeaknessCard.jsx';
import { CheckCircle, XCircle, TrendingUp, Brain, Target, Lightbulb } from 'lucide-react';

const ResultsDashboard = ({ results, onReviewAnswers, onReturnToQuizzes }) => {
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreMessage = (score) => {
    if (score >= 90) return 'Outstanding!';
    if (score >= 75) return 'Great Job!';
    if (score >= 60) return 'Good Effort!';
    return 'Keep Practicing!';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Overall Score */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-900 dark:border-indigo-900">
        <CardContent className="p-6 md:p-8">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 mb-2 dark:text-slate-400">Your Score</p>
            <div className={`text-5xl md:text-6xl font-bold mb-2 ${getScoreColor(results.score)}`}>
              {results.score}%
            </div>
            <p className="text-lg md:text-xl font-semibold text-slate-900 mb-4 dark:text-slate-100">
              {getScoreMessage(results.score)}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                <span>{results.correctAnswers} Correct</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
                <span>{results.totalQuestions - results.correctAnswers} Incorrect</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weaknesses */}
      {results.weaknesses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2 dark:text-slate-100">
            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            Areas for Improvement
          </h2>
          <div className="flex flex-col gap-3">
            {results.weaknesses.map((weakness, index) => (
              <WeaknessCard
                key={index}
                topic={weakness.topic}
                accuracy={weakness.accuracy}
              />
            ))}
          </div>
        </div>
      )}

      {/* Topic Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Topic Breakdown
          </CardTitle>
          <CardDescription>Performance by topic area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.topicBreakdown.map((topic, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{topic.topic}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {topic.correct}/{topic.total} ({topic.accuracy}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      topic.accuracy >= 75 ? 'bg-green-500' :
                      topic.accuracy >= 60 ? 'bg-blue-500' :
                      topic.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${topic.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skill Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Skill Category Analysis
          </CardTitle>
          <CardDescription>Performance by cognitive skill level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {Object.entries(results.skillBreakdown).map(([skill, data]) => (
              <div key={skill} className="p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-600 capitalize mb-1 md:mb-2 dark:text-slate-400">{skill}</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 mb-1 dark:text-slate-100">{data.accuracy}%</p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {data.correct} of {data.total} correct
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <CardContent className="p-4 md:p-6">
          <div className="flex gap-3">
            <Lightbulb className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1 dark:text-blue-400" />
            <div>
              <p className="font-semibold text-blue-900 mb-1 md:mb-2 text-sm md:text-base dark:text-blue-200">Personalized Feedback</p>
              <p className="text-sm text-blue-800 leading-relaxed dark:text-blue-300">{results.diagnosis}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-4">
        <Button
          onClick={onReviewAnswers}
          className="w-full sm:w-auto min-h-[3rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Review Answers
        </Button>
        <Button
          onClick={onReturnToQuizzes}
          variant="outline"
          className="w-full sm:w-auto min-h-[3rem] md:min-h-[2.5rem] text-slate-700 text-base dark:text-slate-300"
        >
          Back to Quizzes
        </Button>
      </div>
    </div>
  );
};

export default ResultsDashboard;