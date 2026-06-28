/* ==========================================================================
   Zenith - Calendar Rendering Engine
   ========================================================================== */

const Calendar = {
    currentWeekOffset: 0, // 0 is current week, -1 is previous, 1 is next

    // Helper to get week start and end dates
    getWeekRange(offsetWeeks = 0) {
        const today = new Date();
        const firstDayOfWeek = new Date(today);
        
        // Find Monday of current week
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        
        firstDayOfWeek.setDate(diff + (offsetWeeks * 7));
        firstDayOfWeek.setHours(0, 0, 0, 0);

        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        lastDayOfWeek.setHours(23, 59, 59, 999);

        return { start: firstDayOfWeek, end: lastDayOfWeek };
    },

    // Formats dates for the header
    formatDateRange(start, end) {
        const options = { month: 'short', day: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', options);
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startStr} - ${endStr}`;
    },

    /**
     * Renders the calendar days header row and inserts tasks into their scheduled time slots
     */
    render(tasks, offsetWeeks = 0) {
        this.currentWeekOffset = offsetWeeks;
        const { start, end } = this.getWeekRange(offsetWeeks);
        
        // Update header label
        document.getElementById('calendar-week-range').textContent = this.formatDateRange(start, end);

        // Render days header columns
        const daysHeaderRow = document.getElementById('calendar-days-header-row');
        daysHeaderRow.innerHTML = '<div class="calendar-day-col-header">Time</div>'; // Empty top-left cell
        
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayDates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(start.getDate() + i);
            currentDay.setHours(0, 0, 0, 0);
            
            dayDates.push(currentDay);
            
            const isToday = currentDay.getTime() === today.getTime();
            
            const colHeader = document.createElement('div');
            colHeader.className = `calendar-day-col-header ${isToday ? 'today' : ''}`;
            colHeader.innerHTML = `
                <div>${dayNames[i]}</div>
                <span>${currentDay.getDate()}</span>
            `;
            daysHeaderRow.appendChild(colHeader);
        }

        // Render scheduled blocks
        const gridBody = document.getElementById('calendar-events-grid-body');
        gridBody.innerHTML = '';

        // Generate schedule blocks using the AI Engine
        const blocks = AIEngine.optimizeSchedule(tasks);
        
        // Total grid height is 450px, representing 9:00 AM to 5:00 PM (8 hours total)
        const gridHeight = 450;
        const totalHours = 8;
        const hourHeight = gridHeight / totalHours; // 56.25px per hour

        blocks.forEach(block => {
            // Find which day of week this block matches
            // dayOfWeek: 0 = Sun, 1 = Mon, 2 = Tue, etc.
            // We want index to match our columns (0 = Mon, 6 = Sun)
            let colIndex = block.dayOfWeek - 1;
            if (block.dayOfWeek === 0) colIndex = 6; // Sunday

            // Check if this block falls within the currently displayed week dates
            const taskDayOfWeekDate = new Date(start);
            taskDayOfWeekDate.setDate(start.getDate() + colIndex);

            // Create visual block element
            const eventEl = document.createElement('div');
            eventEl.className = `calendar-event-block cat-${block.category}`;
            
            // Absolute positioning math
            const topOffset = (block.startHour - 9) * hourHeight;
            const height = block.durationHours * hourHeight;

            eventEl.style.top = `${topOffset}px`;
            eventEl.style.height = `${height}px`;
            eventEl.style.left = `calc(${(colIndex / 7) * 100}% + 4px)`;
            eventEl.style.width = `calc(${(1 / 7) * 100}% - 8px)`;

            eventEl.innerHTML = `
                <div class="event-block-title">${block.title}</div>
                <div class="event-block-time">${block.startTimeStr} - ${block.endTimeStr}</div>
            `;
            
            gridBody.appendChild(eventEl);
        });
    },

    /**
     * Triggers optimization visual animation on the calendar blocks
     */
    animateOptimization() {
        const blocks = document.querySelectorAll('.calendar-event-block');
        blocks.forEach(block => {
            block.classList.add('optimizing');
            // Remove after animation finishes
            setTimeout(() => {
                block.classList.remove('optimizing');
            }, 800);
        });
    }
};
