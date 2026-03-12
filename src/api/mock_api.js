// Mock API with realistic quiz data and localStorage persistence

const STORAGE_KEYS = {
  ATTEMPTS: 'quiz_attempts',
  ANSWERS: 'quiz_answers',
  DISCUSSIONS: 'quiz_discussions',
  USERS: 'quiz_users'
};

// Mock quiz data
const QUIZZES = [
  {
    id: 'quiz-1',
    title: 'Data Structures Fundamentals',
    shortDescription: '',
    longDescription: 'Master the core concepts of arrays, linked lists, stacks, queues, and hash tables',
    description: 'Master the core concepts of arrays, linked lists, stacks, queues, and hash tables',
    topic: 'Data Structures',
    questionCount: 12,
    difficulty: 'intermediate',
    estimatedTime: 25
  },
  {
    id: 'quiz-2',
    title: 'Algorithm Analysis & Complexity',
    shortDescription: '',
    longDescription: 'Deep dive into Big O notation, time complexity, and algorithm optimization techniques',
    description: 'Deep dive into Big O notation, time complexity, and algorithm optimization techniques',
    topic: 'Algorithms',
    questionCount: 15,
    difficulty: 'advanced',
    estimatedTime: 30
  },
  {
    id: 'quiz-3',
    title: 'Database Design Principles',
    shortDescription: '',
    longDescription: 'Learn normalization, indexing, query optimization, and relational database design',
    description: 'Learn normalization, indexing, query optimization, and relational database design',
    topic: 'Database Design',
    questionCount: 10,
    difficulty: 'intermediate',
    estimatedTime: 20
  },
  {
    id: 'quiz-4',
    title: 'Object-Oriented Programming',
    shortDescription: '',
    longDescription: 'Explore inheritance, polymorphism, encapsulation, and design patterns',
    description: 'Explore inheritance, polymorphism, encapsulation, and design patterns',
    topic: 'OOP',
    questionCount: 12,
    difficulty: 'beginner',
    estimatedTime: 22
  }
];

const QUESTIONS = {
  'quiz-1': [
    {
      id: 'q1-1',
      quizId: 'quiz-1',
      text: 'What is the time complexity of inserting an element at the beginning of a singly linked list?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(n)$' },
        { id: 'c', text: '$O(\\log n)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'a',
      difficulty: 'easy',
      topic: 'Linked Lists',
      skillCategory: 'recall',
      explanation: 'Inserting at the beginning of a linked list is $O(1)$ because you only need to create a new node and update the head pointer. No traversal is required.'
    },
    {
      id: 'q1-2',
      quizId: 'quiz-1',
      text: 'Which data structure uses LIFO (Last In First Out) principle?',
      options: [
        { id: 'a', text: 'Queue' },
        { id: 'b', text: 'Stack' },
        { id: 'c', text: 'Array' },
        { id: 'd', text: 'Hash Table' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Stacks',
      skillCategory: 'recall',
      explanation: 'A stack follows the LIFO principle where the last element added is the first one to be removed, like a stack of plates.'
    },
    {
      id: 'q1-3',
      quizId: 'quiz-1',
      text: 'In a hash table with separate chaining, what happens when two keys hash to the same index?',
      options: [
        { id: 'a', text: 'The second key overwrites the first' },
        { id: 'b', text: 'Both keys are stored in a linked list at that index' },
        { id: 'c', text: 'The hash function is recalculated' },
        { id: 'd', text: 'An error is thrown' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Hash Tables',
      skillCategory: 'conceptual',
      explanation: 'Separate chaining handles collisions by maintaining a linked list at each hash table index. When multiple keys hash to the same index, they are all stored in that list.'
    },
    {
      id: 'q1-4',
      quizId: 'quiz-1',
      text: 'What is the average time complexity for searching in a balanced binary search tree?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(\\log n)$' },
        { id: 'c', text: '$O(n)$' },
        { id: 'd', text: '$O(n \\log n)$' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Trees',
      skillCategory: 'recall',
      explanation: 'In a balanced BST, the height is $\\log n$, and searching requires traversing from root to a leaf, giving $O(\\log n)$ time complexity.'
    },
    {
      id: 'q1-5',
      quizId: 'quiz-1',
      text: 'Which operation is NOT efficient in a standard array?',
      options: [
        { id: 'a', text: 'Random access by index' },
        { id: 'b', text: 'Inserting at the beginning' },
        { id: 'c', text: 'Reading the last element' },
        { id: 'd', text: 'Updating an element by index' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Arrays',
      skillCategory: 'conceptual',
      explanation: 'Inserting at the beginning of an array requires shifting all existing elements, making it $O(n)$. Other operations are $O(1)$.'
    },
    {
      id: 'q1-6',
      quizId: 'quiz-1',
      text: 'In a circular queue, what condition indicates that the queue is full?',
      options: [
        { id: 'a', text: '$front == rear$' },
        { id: 'b', text: '$(rear + 1) \\% size == front$' },
        { id: 'c', text: '$rear == size - 1$' },
        { id: 'd', text: '$front == 0$' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Queues',
      skillCategory: 'application',
      explanation: 'In a circular queue, the queue is full when the next position of rear equals front: $$(rear + 1) \\% size == front$$'
    },
    {
      id: 'q1-7',
      quizId: 'quiz-1',
      text: 'What is the main advantage of a doubly linked list over a singly linked list?',
      options: [
        { id: 'a', text: 'Uses less memory' },
        { id: 'b', text: 'Faster insertion at the beginning' },
        { id: 'c', text: 'Can traverse in both directions' },
        { id: 'd', text: 'Better cache performance' }
      ],
      correctAnswer: 'c',
      difficulty: 'easy',
      topic: 'Linked Lists',
      skillCategory: 'conceptual',
      explanation: 'A doubly linked list has both next and previous pointers, allowing bidirectional traversal. This comes at the cost of extra memory.'
    },
    {
      id: 'q1-8',
      quizId: 'quiz-1',
      text: 'Which hash function property ensures that similar keys produce very different hash values?',
      options: [
        { id: 'a', text: 'Determinism' },
        { id: 'b', text: 'Uniformity' },
        { id: 'c', text: 'Avalanche effect' },
        { id: 'd', text: 'Efficiency' }
      ],
      correctAnswer: 'c',
      difficulty: 'hard',
      topic: 'Hash Tables',
      skillCategory: 'conceptual',
      explanation: 'The avalanche effect means that a small change in input produces a significantly different hash value, reducing clustering and collisions.'
    },
    {
      id: 'q1-9',
      quizId: 'quiz-1',
      text: 'What is the space complexity of a recursive function that makes $n$ recursive calls with constant space per call?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(\\log n)$' },
        { id: 'c', text: '$O(n)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Recursion',
      skillCategory: 'application',
      explanation: 'Each recursive call adds a frame to the call stack. With $n$ calls and constant space per call, the total space complexity is $O(n)$.'
    },
    {
      id: 'q1-10',
      quizId: 'quiz-1',
      text: 'In which scenario would you prefer a linked list over an array?',
      options: [
        { id: 'a', text: 'Frequent random access operations' },
        { id: 'b', text: 'Frequent insertions and deletions at arbitrary positions' },
        { id: 'c', text: 'Memory-constrained environment' },
        { id: 'd', text: 'Need for cache-friendly data structure' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Data Structures',
      skillCategory: 'application',
      explanation: 'Linked lists excel at insertions and deletions at arbitrary positions ($O(1)$ after finding the position) compared to arrays which require shifting elements ($O(n)$).'
    },
    {
      id: 'q1-11',
      quizId: 'quiz-1',
      text: 'What is the worst-case time complexity of searching in a hash table?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(\\log n)$' },
        { id: 'c', text: '$O(n)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Hash Tables',
      skillCategory: 'recall',
      explanation: 'In the worst case, all keys hash to the same index, creating a single linked list of length $n$, resulting in $O(n)$ search time.'
    },
    {
      id: 'q1-12',
      quizId: 'quiz-1',
      text: 'Which tree traversal visits nodes in the order: left subtree, root, right subtree?',
      options: [
        { id: 'a', text: 'Preorder' },
        { id: 'b', text: 'Inorder' },
        { id: 'c', text: 'Postorder' },
        { id: 'd', text: 'Level-order' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Trees',
      skillCategory: 'recall',
      explanation: 'Inorder traversal visits the left subtree first, then the root, then the right subtree. For BSTs, this produces sorted output.'
    }
  ],
  'quiz-2': [
    {
      id: 'q2-1',
      quizId: 'quiz-2',
      text: 'What does Big O notation describe?',
      options: [
        { id: 'a', text: 'Exact runtime of an algorithm' },
        { id: 'b', text: 'Upper bound of algorithm growth rate' },
        { id: 'c', text: 'Average case performance' },
        { id: 'd', text: 'Memory usage only' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Complexity Analysis',
      skillCategory: 'recall',
      explanation: 'Big O notation describes the upper bound of an algorithm\'s growth rate as input size increases, representing worst-case scenario.'
    },
    {
      id: 'q2-2',
      quizId: 'quiz-2',
      text: 'Which sorting algorithm has the best worst-case time complexity?',
      options: [
        { id: 'a', text: 'Quick Sort' },
        { id: 'b', text: 'Bubble Sort' },
        { id: 'c', text: 'Merge Sort' },
        { id: 'd', text: 'Selection Sort' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Sorting Algorithms',
      skillCategory: 'recall',
      explanation: 'Merge Sort has $O(n \\log n)$ worst-case time complexity, while Quick Sort can degrade to $O(n^2)$ in worst case.'
    },
    {
      id: 'q2-3',
      quizId: 'quiz-2',
      text: 'What is the time complexity of binary search on a sorted array?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(\\log n)$' },
        { id: 'c', text: '$O(n)$' },
        { id: 'd', text: '$O(n \\log n)$' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Search Algorithms',
      skillCategory: 'recall',
      explanation: 'Binary search divides the search space in half with each comparison, resulting in $O(\\log n)$ time complexity.'
    },
    {
      id: 'q2-4',
      quizId: 'quiz-2',
      text: 'Which algorithm design paradigm does dynamic programming follow?',
      options: [
        { id: 'a', text: 'Divide and conquer' },
        { id: 'b', text: 'Greedy approach' },
        { id: 'c', text: 'Memoization and optimal substructure' },
        { id: 'd', text: 'Backtracking' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Algorithm Design',
      skillCategory: 'conceptual',
      explanation: 'Dynamic programming uses memoization to store solutions to subproblems and builds optimal solutions from optimal substructures.'
    },
    {
      id: 'q2-5',
      quizId: 'quiz-2',
      text: 'What is the space complexity of an iterative algorithm that uses a fixed number of variables?',
      options: [
        { id: 'a', text: '$O(1)$' },
        { id: 'b', text: '$O(\\log n)$' },
        { id: 'c', text: '$O(n)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'a',
      difficulty: 'easy',
      topic: 'Space Complexity',
      skillCategory: 'application',
      explanation: 'Using a fixed number of variables regardless of input size results in constant $O(1)$ space complexity.'
    },
    {
      id: 'q2-6',
      quizId: 'quiz-2',
      text: 'In the context of algorithm analysis, what does "amortized time" mean?',
      options: [
        { id: 'a', text: 'Worst-case time for a single operation' },
        { id: 'b', text: 'Average time per operation over a sequence' },
        { id: 'c', text: 'Best-case time complexity' },
        { id: 'd', text: 'Time complexity ignoring constants' }
      ],
      correctAnswer: 'b',
      difficulty: 'hard',
      topic: 'Complexity Analysis',
      skillCategory: 'conceptual',
      explanation: 'Amortized time is the average time per operation over a worst-case sequence of operations, smoothing out expensive operations.'
    },
    {
      id: 'q2-7',
      quizId: 'quiz-2',
      text: 'Which of these is NOT a stable sorting algorithm?',
      options: [
        { id: 'a', text: 'Merge Sort' },
        { id: 'b', text: 'Insertion Sort' },
        { id: 'c', text: 'Quick Sort (standard implementation)' },
        { id: 'd', text: 'Bubble Sort' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Sorting Algorithms',
      skillCategory: 'recall',
      explanation: 'Standard Quick Sort is not stable because it can change the relative order of equal elements during partitioning.'
    },
    {
      id: 'q2-8',
      quizId: 'quiz-2',
      text: 'What is the time complexity of finding the kth smallest element using QuickSelect on average?',
      options: [
        { id: 'a', text: '$O(k)$' },
        { id: 'b', text: '$O(n)$' },
        { id: 'c', text: '$O(n \\log n)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'b',
      difficulty: 'hard',
      topic: 'Selection Algorithms',
      skillCategory: 'recall',
      explanation: 'QuickSelect has an average time complexity of $O(n)$ by partitioning and recursing on only one side, unlike QuickSort which recurses on both.'
    },
    {
      id: 'q2-9',
      quizId: 'quiz-2',
      text: 'Which graph traversal algorithm uses a queue?',
      options: [
        { id: 'a', text: 'Depth-First Search' },
        { id: 'b', text: 'Breadth-First Search' },
        { id: 'c', text: 'Dijkstra\'s Algorithm' },
        { id: 'd', text: 'Topological Sort' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Graph Algorithms',
      skillCategory: 'recall',
      explanation: 'BFS uses a queue to explore nodes level by level, while DFS uses a stack (or recursion).'
    },
    {
      id: 'q2-10',
      quizId: 'quiz-2',
      text: 'What is the time complexity of the naive string matching algorithm?',
      options: [
        { id: 'a', text: '$O(n)$' },
        { id: 'b', text: '$O(m + n)$' },
        { id: 'c', text: '$O(n \\cdot m)$' },
        { id: 'd', text: '$O(n^2)$' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'String Algorithms',
      skillCategory: 'application',
      explanation: 'The naive approach checks each position in the text ($n$) against the pattern ($m$), resulting in $O(n \\cdot m)$ time complexity.'
    },
    {
      id: 'q2-11',
      quizId: 'quiz-2',
      text: 'Which algorithm design technique does the Knapsack problem commonly use?',
      options: [
        { id: 'a', text: 'Greedy' },
        { id: 'b', text: 'Dynamic Programming' },
        { id: 'c', text: 'Divide and Conquer' },
        { id: 'd', text: 'Backtracking only' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Algorithm Design',
      skillCategory: 'conceptual',
      explanation: 'The 0/1 Knapsack problem is typically solved using dynamic programming to avoid recomputing overlapping subproblems.'
    },
    {
      id: 'q2-12',
      quizId: 'quiz-2',
      text: 'What is the time complexity of building a heap from an unsorted array?',
      options: [
        { id: 'a', text: '$O(n)$' },
        { id: 'b', text: '$O(n \\log n)$' },
        { id: 'c', text: '$O(n^2)$' },
        { id: 'd', text: '$O(\\log n)$' }
      ],
      correctAnswer: 'a',
      difficulty: 'hard',
      topic: 'Heap Operations',
      skillCategory: 'recall',
      explanation: 'Building a heap using the bottom-up approach (heapify) takes $O(n)$ time, not $O(n \\log n)$ as might be expected.'
    },
    {
      id: 'q2-13',
      quizId: 'quiz-2',
      text: 'In Master Theorem, what is the time complexity of $T(n) = 2T(n/2) + O(n)$?',
      options: [
        { id: 'a', text: '$O(n)$' },
        { id: 'b', text: '$O(n \\log n)$' },
        { id: 'c', text: '$O(n^2)$' },
        { id: 'd', text: '$O(\\log n)$' }
      ],
      correctAnswer: 'b',
      difficulty: 'hard',
      topic: 'Recurrence Relations',
      skillCategory: 'application',
      explanation: 'This recurrence (like Merge Sort) falls under Case 2 of Master Theorem, resulting in $O(n \\log n)$ complexity.'
    },
    {
      id: 'q2-14',
      quizId: 'quiz-2',
      text: 'Which data structure is best for implementing Dijkstra\'s algorithm efficiently?',
      options: [
        { id: 'a', text: 'Array' },
        { id: 'b', text: 'Stack' },
        { id: 'c', text: 'Min Heap / Priority Queue' },
        { id: 'd', text: 'Hash Table' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Graph Algorithms',
      skillCategory: 'application',
      explanation: 'A min heap allows efficient extraction of the minimum distance vertex, making Dijkstra\'s algorithm run in $O((V + E) \\log V)$ time.'
    },
    {
      id: 'q2-15',
      quizId: 'quiz-2',
      text: 'What is the primary advantage of using memoization in recursive algorithms?',
      options: [
        { id: 'a', text: 'Reduces space complexity' },
        { id: 'b', text: 'Avoids recomputing overlapping subproblems' },
        { id: 'c', text: 'Makes code more readable' },
        { id: 'd', text: 'Eliminates recursion' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Optimization Techniques',
      skillCategory: 'conceptual',
      explanation: 'Memoization stores results of expensive function calls and returns cached results when the same inputs occur again, avoiding redundant computation.'
    }
  ],
  'quiz-3': [
    {
      id: 'q3-1',
      quizId: 'quiz-3',
      text: 'What is the primary goal of database normalization?',
      options: [
        { id: 'a', text: 'Increase query speed' },
        { id: 'b', text: 'Reduce data redundancy and improve integrity' },
        { id: 'c', text: 'Simplify database schema' },
        { id: 'd', text: 'Reduce storage costs' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Normalization',
      skillCategory: 'recall',
      explanation: 'Normalization aims to reduce data redundancy and improve data integrity by organizing data into related tables.'
    },
    {
      id: 'q3-2',
      quizId: 'quiz-3',
      text: 'Which normal form requires that all non-key attributes depend on the entire primary key?',
      options: [
        { id: 'a', text: '1NF' },
        { id: 'b', text: '2NF' },
        { id: 'c', text: '3NF' },
        { id: 'd', text: 'BCNF' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Normalization',
      skillCategory: 'recall',
      explanation: 'Second Normal Form (2NF) requires that non-key attributes depend on the entire primary key, eliminating partial dependencies.'
    },
    {
      id: 'q3-3',
      quizId: 'quiz-3',
      text: 'What type of index is most efficient for range queries?',
      options: [
        { id: 'a', text: 'Hash index' },
        { id: 'b', text: 'B-tree index' },
        { id: 'c', text: 'Bitmap index' },
        { id: 'd', text: 'Full-text index' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Indexing',
      skillCategory: 'application',
      explanation: 'B-tree indexes maintain sorted order, making them ideal for range queries. Hash indexes are only efficient for equality searches.'
    },
    {
      id: 'q3-4',
      quizId: 'quiz-3',
      text: 'In a one-to-many relationship, where should the foreign key be placed?',
      options: [
        { id: 'a', text: 'In the "one" side table' },
        { id: 'b', text: 'In the "many" side table' },
        { id: 'c', text: 'In a separate junction table' },
        { id: 'd', text: 'In both tables' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Relationships',
      skillCategory: 'recall',
      explanation: 'In a one-to-many relationship, the foreign key is placed in the "many" side table to reference the "one" side.'
    },
    {
      id: 'q3-5',
      quizId: 'quiz-3',
      text: 'What is denormalization typically used for?',
      options: [
        { id: 'a', text: 'Improving data integrity' },
        { id: 'b', text: 'Reducing storage space' },
        { id: 'c', text: 'Improving query performance' },
        { id: 'd', text: 'Simplifying schema design' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Optimization',
      skillCategory: 'conceptual',
      explanation: 'Denormalization intentionally introduces redundancy to improve read performance by reducing the need for joins.'
    },
    {
      id: 'q3-6',
      quizId: 'quiz-3',
      text: 'Which SQL clause is used to filter groups in an aggregate query?',
      options: [
        { id: 'a', text: 'WHERE' },
        { id: 'b', text: 'HAVING' },
        { id: 'c', text: 'GROUP BY' },
        { id: 'd', text: 'ORDER BY' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'SQL Queries',
      skillCategory: 'recall',
      explanation: 'HAVING filters groups after aggregation, while WHERE filters rows before aggregation.'
    },
    {
      id: 'q3-7',
      quizId: 'quiz-3',
      text: 'What is a composite key?',
      options: [
        { id: 'a', text: 'A key made of multiple columns' },
        { id: 'b', text: 'A foreign key referencing multiple tables' },
        { id: 'c', text: 'An encrypted primary key' },
        { id: 'd', text: 'A key with multiple indexes' }
      ],
      correctAnswer: 'a',
      difficulty: 'easy',
      topic: 'Keys',
      skillCategory: 'recall',
      explanation: 'A composite key is a primary key composed of two or more columns that together uniquely identify a row.'
    },
    {
      id: 'q3-8',
      quizId: 'quiz-3',
      text: 'Which type of join returns all rows from both tables, matching where possible?',
      options: [
        { id: 'a', text: 'INNER JOIN' },
        { id: 'b', text: 'LEFT JOIN' },
        { id: 'c', text: 'RIGHT JOIN' },
        { id: 'd', text: 'FULL OUTER JOIN' }
      ],
      correctAnswer: 'd',
      difficulty: 'medium',
      topic: 'SQL Queries',
      skillCategory: 'recall',
      explanation: 'FULL OUTER JOIN returns all rows from both tables, with NULLs where there is no match.'
    },
    {
      id: 'q3-9',
      quizId: 'quiz-3',
      text: 'What is the purpose of a database transaction?',
      options: [
        { id: 'a', text: 'To speed up queries' },
        { id: 'b', text: 'To ensure ACID properties' },
        { id: 'c', text: 'To create backups' },
        { id: 'd', text: 'To normalize data' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Transactions',
      skillCategory: 'conceptual',
      explanation: 'Transactions ensure ACID properties (Atomicity, Consistency, Isolation, Durability) for database operations.'
    },
    {
      id: 'q3-10',
      quizId: 'quiz-3',
      text: 'Which index type is best for columns with very few distinct values?',
      options: [
        { id: 'a', text: 'B-tree index' },
        { id: 'b', text: 'Hash index' },
        { id: 'c', text: 'Bitmap index' },
        { id: 'd', text: 'Clustered index' }
      ],
      correctAnswer: 'c',
      difficulty: 'hard',
      topic: 'Indexing',
      skillCategory: 'application',
      explanation: 'Bitmap indexes are efficient for low-cardinality columns (few distinct values) as they use bit arrays to represent data.'
    }
  ],
  'quiz-4': [
    {
      id: 'q4-1',
      quizId: 'quiz-4',
      text: 'Which OOP principle allows a class to hide its internal implementation details?',
      options: [
        { id: 'a', text: 'Inheritance' },
        { id: 'b', text: 'Polymorphism' },
        { id: 'c', text: 'Encapsulation' },
        { id: 'd', text: 'Abstraction' }
      ],
      correctAnswer: 'c',
      difficulty: 'easy',
      topic: 'OOP Principles',
      skillCategory: 'recall',
      explanation: 'Encapsulation bundles data and methods together and restricts direct access to internal state, hiding implementation details.'
    },
    {
      id: 'q4-2',
      quizId: 'quiz-4',
      text: 'What is polymorphism in OOP?',
      options: [
        { id: 'a', text: 'Creating multiple classes' },
        { id: 'b', text: 'Objects taking multiple forms' },
        { id: 'c', text: 'Hiding data' },
        { id: 'd', text: 'Reusing code' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'OOP Principles',
      skillCategory: 'recall',
      explanation: 'Polymorphism allows objects to take multiple forms, enabling a single interface to represent different underlying data types.'
    },
    {
      id: 'q4-3',
      quizId: 'quiz-4',
      text: 'Which design pattern ensures a class has only one instance?',
      options: [
        { id: 'a', text: 'Factory' },
        { id: 'b', text: 'Singleton' },
        { id: 'c', text: 'Observer' },
        { id: 'd', text: 'Strategy' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Design Patterns',
      skillCategory: 'recall',
      explanation: 'The Singleton pattern restricts instantiation of a class to a single instance and provides global access to it.'
    },
    {
      id: 'q4-4',
      quizId: 'quiz-4',
      text: 'What is the main benefit of inheritance?',
      options: [
        { id: 'a', text: 'Faster execution' },
        { id: 'b', text: 'Code reusability' },
        { id: 'c', text: 'Better security' },
        { id: 'd', text: 'Smaller file size' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'OOP Principles',
      skillCategory: 'conceptual',
      explanation: 'Inheritance allows a class to inherit properties and methods from a parent class, promoting code reusability.'
    },
    {
      id: 'q4-5',
      quizId: 'quiz-4',
      text: 'Which keyword is used to prevent method overriding in many OOP languages?',
      options: [
        { id: 'a', text: 'static' },
        { id: 'b', text: 'final' },
        { id: 'c', text: 'private' },
        { id: 'd', text: 'const' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Inheritance',
      skillCategory: 'recall',
      explanation: 'The "final" keyword (in Java) or similar mechanisms prevent a method from being overridden in subclasses.'
    },
    {
      id: 'q4-6',
      quizId: 'quiz-4',
      text: 'What is an abstract class?',
      options: [
        { id: 'a', text: 'A class that cannot be instantiated' },
        { id: 'b', text: 'A class with no methods' },
        { id: 'c', text: 'A class with only static methods' },
        { id: 'd', text: 'A class with private constructor' }
      ],
      correctAnswer: 'a',
      difficulty: 'easy',
      topic: 'Abstraction',
      skillCategory: 'recall',
      explanation: 'An abstract class cannot be instantiated directly and is meant to be inherited by concrete classes.'
    },
    {
      id: 'q4-7',
      quizId: 'quiz-4',
      text: 'Which design pattern is used to create objects without specifying their exact class?',
      options: [
        { id: 'a', text: 'Singleton' },
        { id: 'b', text: 'Factory' },
        { id: 'c', text: 'Observer' },
        { id: 'd', text: 'Decorator' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Design Patterns',
      skillCategory: 'recall',
      explanation: 'The Factory pattern provides an interface for creating objects without specifying their concrete classes.'
    },
    {
      id: 'q4-8',
      quizId: 'quiz-4',
      text: 'What is composition in OOP?',
      options: [
        { id: 'a', text: 'Inheriting from multiple classes' },
        { id: 'b', text: 'Building complex objects from simpler ones' },
        { id: 'c', text: 'Overriding methods' },
        { id: 'd', text: 'Creating static methods' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'OOP Principles',
      skillCategory: 'conceptual',
      explanation: 'Composition is a "has-a" relationship where complex objects are built by combining simpler objects.'
    },
    {
      id: 'q4-9',
      quizId: 'quiz-4',
      text: 'Which SOLID principle states that classes should be open for extension but closed for modification?',
      options: [
        { id: 'a', text: 'Single Responsibility' },
        { id: 'b', text: 'Open/Closed' },
        { id: 'c', text: 'Liskov Substitution' },
        { id: 'd', text: 'Dependency Inversion' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'SOLID Principles',
      skillCategory: 'recall',
      explanation: 'The Open/Closed Principle states that software entities should be open for extension but closed for modification.'
    },
    {
      id: 'q4-10',
      quizId: 'quiz-4',
      text: 'What is the Observer design pattern used for?',
      options: [
        { id: 'a', text: 'Creating single instances' },
        { id: 'b', text: 'Notifying multiple objects of state changes' },
        { id: 'c', text: 'Building complex objects' },
        { id: 'd', text: 'Hiding implementation details' }
      ],
      correctAnswer: 'b',
      difficulty: 'medium',
      topic: 'Design Patterns',
      skillCategory: 'conceptual',
      explanation: 'The Observer pattern defines a one-to-many dependency where multiple observers are notified when a subject\'s state changes.'
    },
    {
      id: 'q4-11',
      quizId: 'quiz-4',
      text: 'What is method overloading?',
      options: [
        { id: 'a', text: 'Redefining a method in a subclass' },
        { id: 'b', text: 'Multiple methods with the same name but different parameters' },
        { id: 'c', text: 'Calling a method multiple times' },
        { id: 'd', text: 'Making a method static' }
      ],
      correctAnswer: 'b',
      difficulty: 'easy',
      topic: 'Polymorphism',
      skillCategory: 'recall',
      explanation: 'Method overloading allows multiple methods with the same name but different parameter lists in the same class.'
    },
    {
      id: 'q4-12',
      quizId: 'quiz-4',
      text: 'Which principle suggests favoring composition over inheritance?',
      options: [
        { id: 'a', text: 'DRY' },
        { id: 'b', text: 'KISS' },
        { id: 'c', text: 'Gang of Four design principle' },
        { id: 'd', text: 'YAGNI' }
      ],
      correctAnswer: 'c',
      difficulty: 'medium',
      topic: 'Design Principles',
      skillCategory: 'conceptual',
      explanation: 'The Gang of Four advocates "favor composition over inheritance" to achieve more flexible and maintainable designs.'
    }
  ]
};

// Helper functions for localStorage
const getFromStorage = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

// Initialize storage if needed
const initializeStorage = () => {
  if (!getFromStorage(STORAGE_KEYS.ATTEMPTS)) {
    saveToStorage(STORAGE_KEYS.ATTEMPTS, []);
  }
  if (!getFromStorage(STORAGE_KEYS.DISCUSSIONS)) {
    saveToStorage(STORAGE_KEYS.DISCUSSIONS, {});
  }
  if (!getFromStorage(STORAGE_KEYS.USERS)) {
    saveToStorage(STORAGE_KEYS.USERS, [
      { id: 'user-1', email: 'demo@university.edu', password: 'demo123' }
    ]);
  }
};

initializeStorage();

// Simulate network delay
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Authentication API
export const login = async (email, password) => {
  await delay();
  const users = getFromStorage(STORAGE_KEYS.USERS) || [];
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      user: { id: user.id, email: user.email },
      token
    };
  }
  
  throw new Error('Invalid email or password');
};

export const register = async (email, password) => {
  await delay();
  const users = getFromStorage(STORAGE_KEYS.USERS) || [];
  
  if (users.find(u => u.email === email)) {
    throw new Error('Email already registered');
  }
  
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    password
  };
  
  users.push(newUser);
  saveToStorage(STORAGE_KEYS.USERS, users);
  
  const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    success: true,
    user: { id: newUser.id, email: newUser.email },
    token
  };
};

// Quiz API
export const getQuizzes = async () => {
  await delay();
  return QUIZZES;
};

export const getQuizById = async (quizId) => {
  await delay();
  const quiz = QUIZZES.find(q => q.id === quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  return {
    ...quiz,
    questions: QUESTIONS[quizId] || []
  };
};

export const startAttempt = async (quizId, userId) => {
  await delay();
  const quiz = QUIZZES.find(q => q.id === quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  
  const attemptId = `attempt-${Date.now()}`;
  const attempt = {
    id: attemptId,
    quizId,
    userId,
    startedAt: new Date().toISOString(),
    answers: [],
    currentQuestionIndex: 0
  };
  
  const attempts = getFromStorage(STORAGE_KEYS.ATTEMPTS) || [];
  attempts.push(attempt);
  saveToStorage(STORAGE_KEYS.ATTEMPTS, attempts);
  
  return attempt;
};

export const submitAnswer = async (attemptId, questionId, selectedAnswer) => {
  await delay();
  const attempts = getFromStorage(STORAGE_KEYS.ATTEMPTS) || [];
  const attemptIndex = attempts.findIndex(a => a.id === attemptId);
  
  if (attemptIndex === -1) {
    throw new Error('Attempt not found');
  }
  
  const attempt = attempts[attemptIndex];
  const answerIndex = attempt.answers.findIndex(a => a.questionId === questionId);
  
  if (answerIndex >= 0) {
    attempt.answers[answerIndex].selectedAnswer = selectedAnswer;
  } else {
    attempt.answers.push({ questionId, selectedAnswer });
  }
  
  attempts[attemptIndex] = attempt;
  saveToStorage(STORAGE_KEYS.ATTEMPTS, attempts);
  
  return { success: true };
};

export const submitQuiz = async (attemptId) => {
  await delay();
  const attempts = getFromStorage(STORAGE_KEYS.ATTEMPTS) || [];
  const attemptIndex = attempts.findIndex(a => a.id === attemptId);
  
  if (attemptIndex === -1) {
    throw new Error('Attempt not found');
  }
  
  const attempt = attempts[attemptIndex];
  const questions = QUESTIONS[attempt.quizId] || [];
  
  // Calculate results
  let correctAnswers = 0;
  const answersWithCorrectness = attempt.answers.map(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    const isCorrect = question && answer.selectedAnswer === question.correctAnswer;
    if (isCorrect) correctAnswers++;
    return { ...answer, isCorrect };
  });
  
  attempt.completedAt = new Date().toISOString();
  attempt.answers = answersWithCorrectness;
  attempt.score = Math.round((correctAnswers / questions.length) * 100);
  attempt.totalQuestions = questions.length;
  attempt.correctAnswers = correctAnswers;
  
  attempts[attemptIndex] = attempt;
  saveToStorage(STORAGE_KEYS.ATTEMPTS, attempts);
  
  return { attemptId: attempt.id };
};

// Results API
export const getResults = async (attemptId) => {
  await delay();
  const attempts = getFromStorage(STORAGE_KEYS.ATTEMPTS) || [];
  const attempt = attempts.find(a => a.id === attemptId);
  
  if (!attempt || !attempt.completedAt) {
    throw new Error('Results not found');
  }
  
  const questions = QUESTIONS[attempt.quizId] || [];
  
  // Calculate topic breakdown
  const topicStats = {};
  questions.forEach(question => {
    if (!topicStats[question.topic]) {
      topicStats[question.topic] = { correct: 0, total: 0 };
    }
    topicStats[question.topic].total++;
    
    const answer = attempt.answers.find(a => a.questionId === question.id);
    if (answer && answer.isCorrect) {
      topicStats[question.topic].correct++;
    }
  });
  
  const topicBreakdown = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    correct: stats.correct,
    total: stats.total,
    accuracy: Math.round((stats.correct / stats.total) * 100)
  })).sort((a, b) => a.accuracy - b.accuracy);
  
  // Calculate skill breakdown
  const skillStats = {
    recall: { correct: 0, total: 0 },
    conceptual: { correct: 0, total: 0 },
    application: { correct: 0, total: 0 }
  };
  
  questions.forEach(question => {
    const category = question.skillCategory;
    if (skillStats[category]) {
      skillStats[category].total++;
      const answer = attempt.answers.find(a => a.questionId === question.id);
      if (answer && answer.isCorrect) {
        skillStats[category].correct++;
      }
    }
  });
  
  const skillBreakdown = Object.entries(skillStats).reduce((acc, [skill, stats]) => {
    acc[skill] = {
      correct: stats.correct,
      total: stats.total,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    };
    return acc;
  }, {});
  
  // Get weakest areas
  const weaknesses = topicBreakdown.slice(0, 2);
  
  // Generate diagnosis
  let diagnosis = '';
  if (attempt.score >= 90) {
    diagnosis = 'Excellent performance! You have a strong grasp of the material. ';
  } else if (attempt.score >= 75) {
    diagnosis = 'Good work! You understand most concepts well. ';
  } else if (attempt.score >= 60) {
    diagnosis = 'Fair performance. Review the material to strengthen your understanding. ';
  } else {
    diagnosis = 'Additional study recommended. Focus on fundamental concepts. ';
  }
  
  if (weaknesses.length > 0) {
    diagnosis += `Pay special attention to ${weaknesses.map(w => w.topic).join(' and ')}.`;
  }
  
  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    weaknesses,
    topicBreakdown,
    skillBreakdown,
    diagnosis,
    completedAt: attempt.completedAt
  };
};

// Question flagging API
export const flagQuestion = async (questionId, reason) => {
  await delay();
  // In a real app, this would save to backend
  console.log(`Question ${questionId} flagged: ${reason}`);
  return { success: true };
};

// Discussion API
export const getDiscussion = async (questionId) => {
  await delay();
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};
  
  if (!discussions[questionId]) {
    // Initialize with some mock comments
    discussions[questionId] = [
      {
        id: `c-${questionId}-1`,
        author: 'Sarah Chen',
        text: 'Great question! The key insight here is understanding the underlying data structure properties.',
        upvotes: 12,
        status: 'clarified',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: `c-${questionId}-2`,
        author: 'Michael Rodriguez',
        text: 'I found it helpful to draw out the structure on paper to visualize the operations.',
        upvotes: 8,
        status: 'open',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: `c-${questionId}-3`,
        author: 'Emily Watson',
        text: 'Can someone explain the difference between average and worst-case complexity here?',
        upvotes: 5,
        status: 'open',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    ];
    saveToStorage(STORAGE_KEYS.DISCUSSIONS, discussions);
  }
  
  return discussions[questionId].sort((a, b) => b.upvotes - a.upvotes);
};

export const postComment = async (questionId, text, author) => {
  await delay();
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};
  
  if (!discussions[questionId]) {
    discussions[questionId] = [];
  }
  
  const newComment = {
    id: `c-${questionId}-${Date.now()}`,
    author,
    text,
    upvotes: 0,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  
  discussions[questionId].push(newComment);
  saveToStorage(STORAGE_KEYS.DISCUSSIONS, discussions);
  
  return newComment;
};

export const upvoteComment = async (questionId, commentId) => {
  await delay();
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};
  
  if (discussions[questionId]) {
    const comment = discussions[questionId].find(c => c.id === commentId);
    if (comment) {
      comment.upvotes++;
      saveToStorage(STORAGE_KEYS.DISCUSSIONS, discussions);
      return comment;
    }
  }
  
  throw new Error('Comment not found');
};

// Get question details for review
export const getQuestionDetails = async (quizId, questionId) => {
  await delay();
  const questions = QUESTIONS[quizId] || [];
  const question = questions.find(q => q.id === questionId);
  
  if (!question) {
    throw new Error('Question not found');
  }
  
  return question;
};

export const MOCK_QUIZZES = QUIZZES;
export const MOCK_QUESTIONS = QUESTIONS;
