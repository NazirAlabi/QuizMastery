import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { cn } from '@/lib/utils.js';

const LatexRenderer = ({ content, block = false, className }) => {
  // Parse the content to identify LaTeX segments
  // Supports $...$ for inline and $$...$$ for block
  const parts = useMemo(() => {
    if (!content) return [];
    // Split by $$...$$ or $...$
    // The regex captures the delimiters to preserve them in the split array
    return content.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);
  }, [content]);

  const renderPart = (part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Block math
        const math = part.slice(2, -2);
        return <BlockMath key={index} math={math} renderError={(error) => (
            <span key={index} className="text-red-500 text-xs">Could not render equation</span>
        )} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math
        const math = part.slice(1, -1);
        return <InlineMath key={index} math={math} renderError={(error) => (
            <span key={index} className="text-red-500 text-xs">Could not render equation</span>
        )} />;
      } else {
        // Regular text
        return <span key={index}>{part}</span>;
      }
    } catch (error) {
      console.error("LaTeX rendering error:", error);
      return <span key={index} className="text-red-500 text-xs">Could not render equation</span>;
    }
  };

  return (
    <div 
      className={cn(
        "transition-colors duration-300",
        block ? "w-full" : "inline-block",
        className
      )}
    >
      {parts.map((part, index) => renderPart(part, index))}
    </div>
  );
};

export default LatexRenderer;