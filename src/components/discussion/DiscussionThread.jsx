import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { getDiscussion, postComment, upvoteComment } from '@/api/api.js';
import { ThumbsUp, MessageCircle, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';

const DiscussionThread = ({ questionId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadDiscussion();
  }, [questionId]);

  const loadDiscussion = async () => {
    try {
      const data = await getDiscussion(questionId);
      setComments(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load discussion',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsPosting(true);
    try {
      const comment = await postComment(questionId, newComment, user.email);
      setComments(prev => [...prev, comment]);
      setNewComment('');
      toast({
        title: 'Comment Posted',
        description: 'Your comment has been added to the discussion',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive'
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleUpvote = async (commentId) => {
    try {
      const updatedComment = await upvoteComment(questionId, commentId);
      setComments(prev =>
        prev.map(c => c.id === commentId ? updatedComment : c)
          .sort((a, b) => b.upvotes - a.upvotes)
      );
      toast({
        title: 'Upvoted',
        description: 'Your vote has been recorded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upvote comment',
        variant: 'destructive'
      });
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'clarified':
        return 'success';
      case 'updated':
        return 'info';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading discussion...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <MessageCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Discussion ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-6">
        {/* Add Comment Form */}
        <form onSubmit={handlePostComment} className="flex flex-col md:flex-row gap-2 md:gap-3">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add your comment or question..."
            className="flex-1 h-12 md:h-10 text-base md:text-sm"
            disabled={isPosting}
          />
          <Button
            type="submit"
            disabled={isPosting || !newComment.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 md:h-10 w-full md:w-auto dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Send className="h-4 w-4 mr-2 md:mr-0" />
            <span className="md:hidden">Post Comment</span>
          </Button>
        </form>

        {/* Comments List */}
        <div className="space-y-3 md:space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-slate-500 py-8 text-sm md:text-base dark:text-slate-400">
              No comments yet. Be the first to start the discussion!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm md:text-base dark:text-slate-200">{comment.author}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(comment.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(comment.status)} className="text-xs">
                    {comment.status}
                  </Badge>
                </div>
                <p className="text-slate-700 mb-3 text-sm md:text-base leading-relaxed dark:text-slate-300">{comment.text}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpvote(comment.id)}
                  className="text-slate-600 hover:text-indigo-600 h-10 md:h-8 px-2 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  {comment.upvotes}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DiscussionThread;
