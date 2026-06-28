/* ==========================================================================
   Zenith - AI Engine (Intelligence, Prioritization & Auto-Planning)
   ========================================================================== */

const AIEngine = {
    /**
     * Calculates an intelligent prioritization index (0 - 100)
     * Factors:
     * - Proximity to deadline (Weight: 50%)
     * - Energy / Cognitive difficulty rating (Weight: 30%)
     * - Duration estimate (Weight: 20%)
     */
    calculatePriorityScore(task) {
        if (task.completed) return 0;
        
        // 1. Deadline score (closer deadline = higher score)
        const now = new Date();
        const deadline = new Date(task.deadline);
        const timeDiffMs = deadline - now;
        
        let deadlineScore = 0;
        if (timeDiffMs <= 0) {
            deadlineScore = 100; // Past due
        } else {
            const hoursLeft = timeDiffMs / (1000 * 60 * 60);
            if (hoursLeft <= 2) deadlineScore = 100;
            else if (hoursLeft <= 12) deadlineScore = 90;
            else if (hoursLeft <= 24) deadlineScore = 75;
            else if (hoursLeft <= 48) deadlineScore = 55;
            else if (hoursLeft <= 168) deadlineScore = 30; // Within a week
            else deadlineScore = 15;
        }

        // 2. Difficulty score
        let difficultyScore = 50;
        if (task.difficulty === 'high') difficultyScore = 100;
        else if (task.difficulty === 'medium') difficultyScore = 70;
        else if (task.difficulty === 'low') difficultyScore = 30;

        // 3. Duration score (longer tasks need earlier attention)
        let durationScore = 50;
        if (task.duration >= 180) durationScore = 100; // 3+ hours
        else if (task.duration >= 90) durationScore = 80;
        else if (task.duration >= 45) durationScore = 60;
        else durationScore = 30;

        // Calculate weighted score
        const score = (deadlineScore * 0.5) + (difficultyScore * 0.3) + (durationScore * 0.2);
        return Math.min(Math.round(score), 100);
    },

    /**
     * Simulates autonomous AI task decomposition.
     * Generates a step-by-step subtask checklist based on task keywords.
     */
    decomposeTask(title) {
        const lowerTitle = title.toLowerCase();
        
        // 1. Study/Exam Pattern
        if (lowerTitle.includes('study') || lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('learn')) {
            return [
                { id: 'sub-' + Date.now() + '-1', title: 'Review lecture notes & textbook chapters', completed: false },
                { id: 'sub-' + Date.now() + '-2', title: 'Extract key vocabulary and active recall concepts', completed: false },
                { id: 'sub-' + Date.now() + '-3', title: 'Attempt mock questions or flashcard set', completed: false },
                { id: 'sub-' + Date.now() + '-4', title: 'Synthesize weak areas in a 1-page summary', completed: false }
            ];
        }
        
        // 2. Presentation/Slide Pattern
        if (lowerTitle.includes('presentation') || lowerTitle.includes('slides') || lowerTitle.includes('speech') || lowerTitle.includes('talk')) {
            return [
                { id: 'sub-' + Date.now() + '-1', title: 'Outline script storyline & core takeaways', completed: false },
                { id: 'sub-' + Date.now() + '-2', title: 'Draft slide contents, layout grids & visual assets', completed: false },
                { id: 'sub-' + Date.now() + '-3', title: 'Perform initial vocal run-through and time-check', completed: false },
                { id: 'sub-' + Date.now() + '-4', title: 'Polishing slide transitions & final dress rehearsal', completed: false }
            ];
        }

        // 3. Coding/Project Pattern
        if (lowerTitle.includes('code') || lowerTitle.includes('program') || lowerTitle.includes('develop') || lowerTitle.includes('app') || lowerTitle.includes('bug') || lowerTitle.includes('build')) {
            return [
                { id: 'sub-' + Date.now() + '-1', title: 'Diagram software architecture / UI wireframe flow', completed: false },
                { id: 'sub-' + Date.now() + '-2', title: 'Initialize codebase structure and config parameters', completed: false },
                { id: 'sub-' + Date.now() + '-3', title: 'Code core functionality & logic controllers', completed: false },
                { id: 'sub-' + Date.now() + '-4', title: 'Run unit testing checks and refine styling UI', completed: false }
            ];
        }

        // 4. Report/Writing Pattern
        if (lowerTitle.includes('report') || lowerTitle.includes('draft') || lowerTitle.includes('write') || lowerTitle.includes('paper') || lowerTitle.includes('essay')) {
            return [
                { id: 'sub-' + Date.now() + '-1', title: 'Gather relevant references, facts & citations', completed: false },
                { id: 'sub-' + Date.now() + '-2', title: 'Formulate thesis intro & structural body outline', completed: false },
                { id: 'sub-' + Date.now() + '-3', title: 'Draft draft content (avoid editing while writing)', completed: false },
                { id: 'sub-' + Date.now() + '-4', title: 'Proofread flow, syntax style and verify requirements', completed: false }
            ];
        }

        // 5. Workout/Health Pattern
        if (lowerTitle.includes('gym') || lowerTitle.includes('workout') || lowerTitle.includes('run') || lowerTitle.includes('exercise') || lowerTitle.includes('fit')) {
            return [
                { id: 'sub-' + Date.now() + '-1', title: 'Pre-workout dynamic stretching & hydration check', completed: false },
                { id: 'sub-' + Date.now() + '-2', title: 'Perform warm-up sets & core compound movements', completed: false },
                { id: 'sub-' + Date.now() + '-3', title: 'Complete targeted accessory sets & conditioning drills', completed: false },
                { id: 'sub-' + Date.now() + '-4', title: 'Post-workout cooldown stretches & protein replenishment', completed: false }
            ];
        }

        // 6. Generic Fallback
        return [
            { id: 'sub-' + Date.now() + '-1', title: 'Define key objective & criteria for completion', completed: false },
            { id: 'sub-' + Date.now() + '-2', title: 'Gather all tools, links & dependencies', completed: false },
            { id: 'sub-' + Date.now() + '-3', title: 'Execute primary task segments (Deep Work focus block)', completed: false },
            { id: 'sub-' + Date.now() + '-4', title: 'Verify quality check and mark as complete', completed: false }
        ];
    },

    /**
     * AI Schedule Optimizer
     * Groups active tasks into a calendar layout logic:
     * - Heavy/High Energy tasks are planned for the morning (10 AM - 12 PM)
     * - Medium tasks are filled around them
     * - Low energy tasks are kept in the afternoon
     * - Inserts "Rest & Recharge" breaks automatically between heavy tasks
     */
    optimizeSchedule(tasks) {
        const activeTasks = tasks.filter(t => !t.completed);
        if (activeTasks.length === 0) return [];

        // Sort active tasks: High energy first, then Medium, then Low
        const energyOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        activeTasks.sort((a, b) => energyOrder[b.difficulty] - energyOrder[a.difficulty]);

        const calendarBlocks = [];
        let currentHour = 9; // Starts at 9:00 AM
        let currentMinute = 0;

        // Helper to format block time
        const makeTimeStr = (h, m) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const displayH = h > 12 ? h - 12 : h;
            return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
        };

        for (let i = 0; i < activeTasks.length; i++) {
            const task = activeTasks[i];
            
            // If we exceeded 5:00 PM, push to next day or limit
            if (currentHour >= 17) break;

            const startHour = currentHour;
            const startMin = currentMinute;
            
            // Calculate end time
            let durationMin = parseInt(task.duration) || 60;
            let endMin = startMin + durationMin;
            let endHour = startHour + Math.floor(endMin / 60);
            endMin = endMin % 60;

            calendarBlocks.push({
                taskId: task.id,
                title: task.title,
                category: task.category,
                startTimeStr: makeTimeStr(startHour, startMin),
                endTimeStr: makeTimeStr(endHour, endMin),
                startHour: startHour + (startMin / 60),
                durationHours: durationMin / 60,
                dayOfWeek: new Date(task.deadline).getDay() || 1 // Fallback to Monday if invalid
            });

            // Update current pointer
            currentHour = endHour;
            currentMinute = endMin;

            // AI Insertion: If it was a HIGH energy task, insert a mandatory 15 min rest block
            if (task.difficulty === 'high' && currentHour < 17) {
                const restStartHour = currentHour;
                const restStartMin = currentMinute;
                
                let restEndMin = restStartMin + 15;
                let restEndHour = restStartHour + Math.floor(restEndMin / 60);
                restEndMin = restEndMin % 60;

                calendarBlocks.push({
                    taskId: 'ai-break-' + Date.now(),
                    title: '🧘 AI Guided Recharge Break',
                    category: 'life', // Default styling
                    startTimeStr: makeTimeStr(restStartHour, restStartMin),
                    endTimeStr: makeTimeStr(restEndHour, restEndMin),
                    startHour: restStartHour + (restStartMin / 60),
                    durationHours: 0.25,
                    dayOfWeek: new Date(task.deadline).getDay() || 1
                });

                currentHour = restEndHour;
                currentMinute = restEndMin;
            }
        }

        return calendarBlocks;
    },

    /**
     * Generates personalized insights and reminders based on status.
     */
    getAIInsightRecommendations(tasks, habits) {
        const activeTasks = tasks.filter(t => !t.completed);
        const insights = [];

        // Insight 1: General task volume
        if (activeTasks.length > 5) {
            insights.push({
                type: 'warning',
                title: 'High Cognitive Load',
                description: `You have ${activeTasks.length} active tasks. Focus on completing high-priority items first to prevent exhaustion.`
            });
        } else if (activeTasks.length === 0) {
            insights.push({
                type: 'green',
                title: 'Clean Workspace',
                description: 'Awesome! Your agenda is clear. Ask Zenith to plan a habit, study project, or enjoy a guilt-free restorative evening.'
            });
        } else {
            insights.push({
                type: 'green',
                title: 'Sufficient Bandwidth',
                description: `You have ${activeTasks.length} active tasks remaining. Zenith has optimized your timeblocks for maximum flow.`
            });
        }

        // Insight 2: High Difficulty Task
        const highEnergyTask = activeTasks.find(t => t.difficulty === 'high');
        if (highEnergyTask) {
            insights.push({
                type: 'purple',
                title: 'Peak Focus Needed',
                description: `"${highEnergyTask.title}" requires intensive cognitive reserves. Try tackling it right after your morning tea.`
            });
        }

        // Insight 3: Habit streaks
        const activeHabits = habits.length;
        if (activeHabits > 0) {
            const bestHabit = habits.reduce((prev, current) => (prev.streak > current.streak) ? prev : current, habits[0]);
            if (bestHabit && bestHabit.streak > 0) {
                insights.push({
                    type: 'cyan',
                    title: 'Habit Consistency',
                    description: `Your habit "${bestHabit.name}" has a streak of ${bestHabit.streak} days. Consistent repetition builds lasting neural pathways!`
                });
            }
        } else {
            insights.push({
                type: 'pink',
                title: 'Establish a Ritual',
                description: 'Adding a simple daily habit like "Read 15 minutes" or "Drink 2L Water" boosts ambient self-regulation score.'
            });
        }

        return insights;
    }
};
