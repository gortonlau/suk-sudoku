class SudokuGame {
    constructor() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.initialGrid = Array(9).fill().map(() => Array(9).fill(0));
        this.hintNumbers = Array(9).fill().map(() => Array(9).fill(false)); // 跟踪提醒数字
        this.selectedCell = null;
        this.selectedNumber = 0; // 默认选中清除按钮
        this.hintMode = false; // 提醒模式
        this.hintTarget = null; // 提醒目标单元格
        this.timer = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.hintCount = 0;
        this.difficulty = 'easy';
        this.isGameComplete = false;

        // 撤销/重做系统
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        this.initializeGame();
        this.bindEvents();
    }

    initializeGame() {
        this.createGrid();
        this.generateNewGame();
    }

    createGrid() {
        const gridElement = document.getElementById('sudoku-grid');
        gridElement.innerHTML = '';
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // 添加3x3区域的特殊边框
                if (col === 2 || col === 5) {
                    cell.style.borderRight = '3px solid #2d3748';
                }
                if (row === 2 || row === 5) {
                    cell.style.borderBottom = '3px solid #2d3748';
                }
                
                cell.addEventListener('click', () => this.selectCell(row, col));
                gridElement.appendChild(cell);
            }
        }
    }

    generateNewGame() {
        this.resetGame();
        this.difficulty = document.getElementById('difficulty-select').value;
        
        // 生成完整的数独解决方案
        this.generateSolution();
        
        // 根据难度移除数字
        this.createPuzzle();
        
        // 保存初始状态
        this.initialGrid = this.grid.map(row => [...row]);
        
        this.updateDisplay();
        this.startTimer();
        this.updateProgress();

        // 初始化历史记录
        this.history = [];
        this.historyIndex = -1;
        this.updateUndoRedoButtons();

        // 确保清除按钮被选中
        this.selectNumber(0);
    }

    generateSolution() {
        // 清空网格
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        
        // 使用回溯算法生成完整解决方案
        this.solveSudoku(this.solution);
        
        // 复制解决方案到当前网格
        this.grid = this.solution.map(row => [...row]);
    }

    solveSudoku(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const numbers = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (let num of numbers) {
                        if (this.isValidMove(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.solveSudoku(grid)) {
                                return true;
                            }
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    createPuzzle() {
        const difficultySettings = {
            easy: {
                minKeep: 5,     // 每个九宫格最少保留5个数字
                maxKeep: 7,     // 每个九宫格最多保留7个数字
                totalTarget: 45, // 全局目标：保留45个数字（相对容易）
                distribution: 'scattered'  // 松散分布
            },
            medium: {
                minKeep: 3,     // 每个九宫格最少保留3个数字
                maxKeep: 5,     // 每个九宫格最多保留5个数字
                totalTarget: 35, // 全局目标：保留35个数字（中等难度）
                distribution: 'balanced'  // 平衡分布
            },
            hard: {
                minKeep: 2,     // 每个九宫格最少保留2个数字
                maxKeep: 4,     // 每个九宫格最多保留4个数字
                totalTarget: 25, // 全局目标：保留25个数字（高难度）
                distribution: 'minimal'  // 最少分布（更有挑战性）
            }
        };

        const settings = difficultySettings[this.difficulty];

        // 为每个3x3九宫格分别处理
        for (let boxRow = 0; boxRow < 3; boxRow++) {
            for (let boxCol = 0; boxCol < 3; boxCol++) {
                this.createBoxPuzzle(boxRow, boxCol, settings);
            }
        }

        // 检查总数并调整
        this.adjustTotalNumbers(settings.totalTarget);
    }

    createBoxPuzzle(boxRow, boxCol, settings) {
        const boxPositions = [];

        // 收集当前九宫格的所有位置
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
            for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) {
                boxPositions.push([r, c]);
            }
        }

        // 根据难度确定保留数字的数量
        const keepCount = Math.floor(Math.random() * (settings.maxKeep - settings.minKeep + 1)) + settings.minKeep;

        let positionsToKeep = [];

        switch (settings.distribution) {
            case 'scattered':
                // 松散分布：尽量分散在九宫格的不同区域
                positionsToKeep = this.getScatteredPositions(boxPositions, keepCount);
                break;
            case 'balanced':
                // 平衡分布：随机但相对均匀
                positionsToKeep = this.getBalancedPositions(boxPositions, keepCount);
                break;
            case 'minimal':
                // 最少分布：优先保留关键位置
                positionsToKeep = this.getMinimalPositions(boxPositions, keepCount);
                break;
        }

        // 清空所有位置
        for (let [row, col] of boxPositions) {
            this.grid[row][col] = 0;
        }

        // 只保留选中的位置
        for (let [row, col] of positionsToKeep) {
            this.grid[row][col] = this.solution[row][col];
        }
    }

    getScatteredPositions(positions, count) {
        // 松散分布：优先选择角落和边缘位置，避免中心聚集
        const corners = [positions[0], positions[2], positions[6], positions[8]]; // 四个角
        const edges = [positions[1], positions[3], positions[5], positions[7]];   // 四个边
        const center = [positions[4]]; // 中心

        let selected = [];

        // 根据数量分配策略
        if (count <= 2) {
            // 少量数字：优先选择角落
            const shuffledCorners = this.shuffleArray([...corners]);
            selected = shuffledCorners.slice(0, count);
        } else if (count <= 4) {
            // 中等数量：角落 + 边缘
            const shuffledCorners = this.shuffleArray([...corners]);
            const shuffledEdges = this.shuffleArray([...edges]);
            selected.push(...shuffledCorners.slice(0, Math.min(2, count)));
            if (selected.length < count) {
                selected.push(...shuffledEdges.slice(0, count - selected.length));
            }
        } else {
            // 较多数字：避免中心，优先外围
            const outerPositions = [...corners, ...edges];
            const shuffledOuter = this.shuffleArray(outerPositions);
            selected.push(...shuffledOuter.slice(0, Math.min(count, 8)));

            // 如果还需要更多，才考虑中心
            if (selected.length < count) {
                selected.push(...center);
            }
        }

        return selected;
    }

    getBalancedPositions(positions, count) {
        // 平衡分布：完全随机
        const shuffled = this.shuffleArray([...positions]);
        return shuffled.slice(0, count);
    }

    getMinimalPositions(positions, count) {
        // 最少分布：优先保留关键位置，增加难度
        const corners = [positions[0], positions[2], positions[6], positions[8]]; // 四个角
        const edges = [positions[1], positions[3], positions[5], positions[7]];   // 四个边
        const center = [positions[4]]; // 中心位置

        let selected = [];

        if (count <= 2) {
            // 极少数字：只保留角落或边缘，避免中心
            const outerPositions = [...corners, ...edges];
            const shuffled = this.shuffleArray(outerPositions);
            selected = shuffled.slice(0, count);
        } else if (count <= 4) {
            // 少量数字：优先角落，然后边缘，最后中心
            const shuffledCorners = this.shuffleArray([...corners]);
            selected.push(...shuffledCorners.slice(0, Math.min(count, 4)));

            if (selected.length < count) {
                const shuffledEdges = this.shuffleArray([...edges]);
                selected.push(...shuffledEdges.slice(0, count - selected.length));
            }

            // 如果还需要更多，才考虑中心
            if (selected.length < count) {
                selected.push(...center);
            }
        } else {
            // 较多数字：随机分布但仍然有策略
            const shuffled = this.shuffleArray([...positions]);
            selected = shuffled.slice(0, count);
        }

        return selected;
    }

    adjustTotalNumbers(targetTotal) {
        // 计算当前保留的数字总数
        let currentTotal = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    currentTotal++;
                }
            }
        }

        // 如果当前总数超过目标，随机移除一些数字
        if (currentTotal > targetTotal) {
            const excess = currentTotal - targetTotal;
            const filledPositions = [];

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] !== 0) {
                        filledPositions.push([row, col]);
                    }
                }
            }

            // 随机选择要移除的位置
            const shuffled = this.shuffleArray(filledPositions);
            for (let i = 0; i < excess && i < shuffled.length; i++) {
                const [row, col] = shuffled[i];
                this.grid[row][col] = 0;
            }
        }
        // 如果当前总数少于目标，随机添加一些数字
        else if (currentTotal < targetTotal) {
            const needed = targetTotal - currentTotal;
            const emptyPositions = [];

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] === 0) {
                        emptyPositions.push([row, col]);
                    }
                }
            }

            // 随机选择要添加的位置
            const shuffled = this.shuffleArray(emptyPositions);
            for (let i = 0; i < needed && i < shuffled.length; i++) {
                const [row, col] = shuffled[i];
                this.grid[row][col] = this.solution[row][col];
            }
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    isValidMove(grid, row, col, num) {
        // 检查行
        for (let c = 0; c < 9; c++) {
            if (grid[row][c] === num) return false;
        }
        
        // 检查列
        for (let r = 0; r < 9; r++) {
            if (grid[r][col] === num) return false;
        }
        
        // 检查3x3区域
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        
        return true;
    }

    selectCell(row, col) {
        if (this.isPaused || this.isGameComplete) return;

        // 如果在提醒模式，处理提醒点击
        if (this.hintMode) {
            this.handleHintClick(row, col);
            return;
        }

        // 检查是否是初始数字（不能修改）
        if (this.initialGrid[row][col] !== 0) return;

        // 总是有选中的数字（包括清除），直接放置
        this.placeNumberAtCell(row, col, this.selectedNumber);
    }

    setSelectedCell(row, col) {
        // 移除之前选中的单元格
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('selected');
        });

        // 选中新单元格
        this.selectedCell = { row, col };
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        cellElement.classList.add('selected');
    }

    selectNumber(num) {
        // 如果点击的是已选中的数字，则选择清除按钮
        if (this.selectedNumber === num) {
            this.selectedNumber = 0;
            num = 0;
        } else {
            this.selectedNumber = num;
        }

        // 更新数字按钮状态
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-number="${num}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // 高亮网格中相同的数字
        this.highlightSameNumbers(num === 0 ? null : num);
    }

    placeNumberAtCell(row, col, num) {
        if (this.isPaused || this.isGameComplete) return;

        // 清除之前的错误样式
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        cellElement.classList.remove('error', 'hint', 'invalid');

        if (num === 0) {
            // 保存到历史记录
            const oldValue = this.grid[row][col];
            this.saveToHistory(row, col, oldValue, 0);

            // 清除数字
            this.grid[row][col] = 0;

            // 清除提醒数字标记
            this.hintNumbers[row][col] = false;

            this.updateDisplay();
            this.updateProgress();
            this.checkGameComplete();

            // 重新高亮相同数字（清除时不高亮）
            this.highlightSameNumbers(null);
        } else {
            // 检查是否存在冲突
            const conflicts = this.findConflicts(row, col, num);

            if (conflicts.length === 0) {
                // 保存到历史记录
                const oldValue = this.grid[row][col];
                this.saveToHistory(row, col, oldValue, num);

                // 无冲突：放置数字
                this.grid[row][col] = num;

                // 清除提醒数字标记（用户手动输入的数字不是提醒数字）
                this.hintNumbers[row][col] = false;

                this.updateDisplay();
                this.updateProgress();
                this.checkGameComplete();
                this.showMessage('', '');

                // 重新高亮相同数字
                this.highlightSameNumbers(num);
            } else {
                // 有冲突：高亮冲突的数字，不放置
                this.highlightConflicts(conflicts);
                this.showMessage('存在数字冲突！', 'error');

                // 1秒后移除冲突高亮
                setTimeout(() => {
                    this.clearConflictHighlights();
                }, 1000);
            }
        }
    }

    findConflicts(row, col, num) {
        const conflicts = [];

        // 检查行冲突
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.grid[row][c] === num) {
                conflicts.push({ row, col: c });
            }
        }

        // 检查列冲突
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.grid[r][col] === num) {
                conflicts.push({ row: r, col });
            }
        }

        // 检查3x3区域冲突
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if ((r !== row || c !== col) && this.grid[r][c] === num) {
                    conflicts.push({ row: r, col: c });
                }
            }
        }

        return conflicts;
    }

    highlightConflicts(conflicts) {
        // 清除之前的冲突高亮
        this.clearConflictHighlights();

        // 高亮所有冲突的单元格
        conflicts.forEach(({ row, col }) => {
            const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            cellElement.classList.add('conflict');
        });
    }

    clearConflictHighlights() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('conflict');
        });
    }

    // 历史记录管理 - 只保存单步操作
    saveToHistory(row, col, oldValue, newValue) {
        // 移除当前位置之后的历史记录
        this.history = this.history.slice(0, this.historyIndex + 1);

        // 添加新的操作记录
        const operation = {
            row: row,
            col: col,
            oldValue: oldValue,
            newValue: newValue,
            oldHintStatus: this.hintNumbers[row][col], // 保存提醒状态
            timestamp: Date.now()
        };

        this.history.push(operation);

        // 限制历史记录大小
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex >= 0) {
            const operation = this.history[this.historyIndex];

            // 恢复到操作前的状态
            this.grid[operation.row][operation.col] = operation.oldValue;

            // 恢复提醒数字状态
            if (operation.oldHintStatus !== undefined) {
                this.hintNumbers[operation.row][operation.col] = operation.oldHintStatus;
            }

            this.historyIndex--;

            // 清除选中状态
            this.selectedCell = null;
            document.querySelectorAll('.cell').forEach(cell => {
                cell.classList.remove('selected');
            });

            this.updateDisplay();
            this.updateProgress();
            this.updateUndoRedoButtons();

            // 重新高亮当前选中的数字
            this.highlightSameNumbers(this.selectedNumber === 0 ? null : this.selectedNumber);

            this.showMessage('已撤销上一步操作', 'info');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const operation = this.history[this.historyIndex];

            // 重新执行操作
            this.grid[operation.row][operation.col] = operation.newValue;

            // 如果新值是通过提醒填入的，需要重新标记
            if (operation.newValue !== 0 && operation.newValue === this.solution[operation.row][operation.col] && operation.oldValue === 0) {
                this.hintNumbers[operation.row][operation.col] = true;
            } else {
                this.hintNumbers[operation.row][operation.col] = false;
            }

            // 清除选中状态
            this.selectedCell = null;
            document.querySelectorAll('.cell').forEach(cell => {
                cell.classList.remove('selected');
            });

            this.updateDisplay();
            this.updateProgress();
            this.updateUndoRedoButtons();

            // 重新高亮当前选中的数字
            this.highlightSameNumbers(this.selectedNumber === 0 ? null : this.selectedNumber);

            this.showMessage('已重做操作', 'info');
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');

        undoBtn.disabled = this.historyIndex < 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    // 保存和加载游戏
    showSaveDialog() {
        const now = new Date();
        const defaultName = `保存于：${now.toLocaleString()}`;

        document.getElementById('save-name').value = defaultName;
        document.getElementById('save-modal').style.display = 'block';

        // 聚焦到输入框并选中文本
        setTimeout(() => {
            const input = document.getElementById('save-name');
            input.focus();
            input.select();
        }, 100);
    }

    saveGame(saveName) {
        if (!saveName || saveName.trim() === '') {
            this.showMessage('请输入保存名称', 'error');
            return;
        }

        const gameState = {
            name: saveName.trim(),
            grid: this.grid,
            solution: this.solution,
            initialGrid: this.initialGrid,
            hintNumbers: this.hintNumbers, // 保存提醒数字数组
            timer: this.timer,
            hintCount: this.hintCount,
            difficulty: this.difficulty,
            history: this.history,
            historyIndex: this.historyIndex,
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        };

        try {
            // 获取现有的保存列表
            const savedGames = this.getSavedGames();
            savedGames.push(gameState);

            // 保存到localStorage
            localStorage.setItem('sudoku_saves', JSON.stringify(savedGames));

            // 关闭保存弹窗
            document.getElementById('save-modal').style.display = 'none';

            this.showMessage('游戏已保存！', 'success');
        } catch (error) {
            this.showMessage('保存失败，请检查浏览器存储空间', 'error');
        }
    }

    showLoadDialog() {
        const savedGames = this.getSavedGames();
        const saveList = document.getElementById('save-list');

        if (savedGames.length === 0) {
            saveList.innerHTML = '<div class="empty-saves">暂无保存的游戏</div>';
        } else {
            saveList.innerHTML = savedGames.map(save => `
                <div class="save-item">
                    <div class="save-item-info">
                        <div class="save-item-name">${save.name}</div>
                        <div class="save-item-details">
                            难度：${this.getDifficultyText(save.difficulty)} |
                            时间：${this.formatTime(save.timer)} |
                            提醒：${save.hintCount}次 |
                            保存时间：${new Date(save.timestamp).toLocaleString()}
                        </div>
                    </div>
                    <div class="save-item-actions">
                        <button class="save-item-btn load-btn" onclick="game.loadGame('${save.id}')">加载</button>
                        <button class="save-item-btn delete-btn" onclick="game.deleteSave('${save.id}')">删除</button>
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('load-modal').style.display = 'block';
    }

    loadGame(saveId) {
        try {
            const savedGames = this.getSavedGames();
            const gameState = savedGames.find(save => save.id === saveId);

            if (!gameState) {
                this.showMessage('找不到指定的保存文件', 'error');
                return;
            }

            // 恢复游戏状态
            this.grid = gameState.grid;
            this.solution = gameState.solution;
            this.initialGrid = gameState.initialGrid;
            this.hintNumbers = gameState.hintNumbers || Array(9).fill().map(() => Array(9).fill(false)); // 加载提醒数字数组
            this.timer = gameState.timer;
            this.hintCount = gameState.hintCount;
            this.difficulty = gameState.difficulty;
            this.history = gameState.history || [];
            this.historyIndex = gameState.historyIndex || -1;

            // 更新界面
            document.getElementById('difficulty-select').value = this.difficulty;
            this.updateDisplay();
            this.updateProgress();
            this.updateTimerDisplay();
            this.updateUndoRedoButtons();
            this.startTimer();

            // 关闭加载弹窗
            document.getElementById('load-modal').style.display = 'none';

            this.showMessage(`已加载游戏：${gameState.name}`, 'success');

        } catch (error) {
            this.showMessage('加载游戏失败', 'error');
        }
    }

    deleteSave(saveId) {
        if (confirm('确定要删除这个保存的游戏吗？')) {
            try {
                const savedGames = this.getSavedGames();
                const filteredGames = savedGames.filter(save => save.id !== saveId);

                localStorage.setItem('sudoku_saves', JSON.stringify(filteredGames));

                // 刷新加载列表
                this.showLoadDialog();

                this.showMessage('保存文件已删除', 'info');
            } catch (error) {
                this.showMessage('删除失败', 'error');
            }
        }
    }

    getSavedGames() {
        try {
            const saved = localStorage.getItem('sudoku_saves');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            return [];
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    getDifficultyText(difficulty) {
        const difficultyMap = {
            easy: '初级',
            medium: '中级',
            hard: '高级'
        };
        return difficultyMap[difficulty] || '未知';
    }

    hasSavedGame() {
        return this.getSavedGames().length > 0;
    }

    highlightSameNumbers(num) {
        // 清除之前的高亮
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('highlight-same');
        });

        if (num === null || num === 0) return;

        // 高亮相同数字
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === num) {
                    const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    cellElement.classList.add('highlight-same');
                }
            }
        }
    }

    updateDisplay() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const value = this.grid[row][col];

                cellElement.textContent = value === 0 ? '' : value;

                // 清除所有状态类（除了selected，因为它由其他方法管理）
                cellElement.classList.remove('hint', 'error', 'hint-target', 'invalid', 'highlight-same', 'conflict');

                // 标记初始数字
                if (this.initialGrid[row][col] !== 0) {
                    cellElement.classList.add('given');
                } else {
                    cellElement.classList.remove('given');
                }

                // 标记提醒数字
                if (this.hintNumbers[row][col]) {
                    cellElement.classList.add('hint-number');
                } else {
                    cellElement.classList.remove('hint-number');
                }
            }
        }
    }

    bindEvents() {
        // 新游戏按钮
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.showNewGameConfirm();
        });

        // 难度选择
        document.getElementById('difficulty-select').addEventListener('change', () => {
            if (confirm('更改难度将开始新游戏，确定继续吗？')) {
                this.generateNewGame();
            } else {
                // 恢复之前的选择
                document.getElementById('difficulty-select').value = this.difficulty;
            }
        });

        // 保存和加载
        document.getElementById('save-game-btn').addEventListener('click', () => {
            this.showSaveDialog();
        });

        document.getElementById('load-game-btn').addEventListener('click', () => {
            if (this.hasSavedGame()) {
                this.showLoadDialog();
            } else {
                this.showMessage('没有找到保存的游戏', 'info');
            }
        });

        // 保存弹窗事件
        document.getElementById('confirm-save-btn').addEventListener('click', () => {
            const saveName = document.getElementById('save-name').value;
            this.saveGame(saveName);
        });

        document.getElementById('cancel-save-btn').addEventListener('click', () => {
            document.getElementById('save-modal').style.display = 'none';
        });

        // 保存名称输入框回车事件
        document.getElementById('save-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const saveName = document.getElementById('save-name').value;
                this.saveGame(saveName);
            } else if (e.key === 'Escape') {
                document.getElementById('save-modal').style.display = 'none';
            }
        });

        // 加载弹窗事件
        document.getElementById('cancel-load-btn').addEventListener('click', () => {
            document.getElementById('load-modal').style.display = 'none';
        });

        // 新游戏确认弹窗事件
        document.getElementById('confirm-new-game-btn').addEventListener('click', () => {
            document.getElementById('new-game-confirm-modal').style.display = 'none';
            this.generateNewGame();
        });

        document.getElementById('cancel-new-game-btn').addEventListener('click', () => {
            document.getElementById('new-game-confirm-modal').style.display = 'none';
        });

        // 撤销和重做
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redo();
        });
        
        // 数字按钮
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.number);
                this.selectNumber(num);
            });
        });

        // 键盘输入和快捷键
        document.addEventListener('keydown', (e) => {
            // 防止在输入框中触发
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.key >= '1' && e.key <= '9') {
                this.selectNumber(parseInt(e.key));
            } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
                this.selectNumber(0);
            } else if (e.key === 'Escape') {
                // ESC键选择清除
                this.selectNumber(0);
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + 快捷键
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveGame();
                        break;
                    case 'o':
                        e.preventDefault();
                        if (this.hasSavedGame()) {
                            this.loadGame();
                        }
                        break;
                    case 'n':
                        e.preventDefault();
                        this.showNewGameConfirm();
                        break;
                }
            } else if (e.key === 'h' || e.key === 'H') {
                // H键显示提醒
                this.showHint();
            } else if (e.key === 'r' || e.key === 'R') {
                // R键快速重新开始
                e.preventDefault();
                this.showNewGameConfirm();
            } else if (e.key === ' ') {
                // 空格键暂停/继续
                e.preventDefault();
                this.togglePause();
            }
        });
        
        // 提醒按钮
        document.getElementById('hint-btn').addEventListener('click', () => {
            this.showHint();
        });
        
        // 检查错误按钮
        document.getElementById('check-btn').addEventListener('click', () => {
            this.checkErrors();
        });
        
        // 显示答案按钮
        document.getElementById('solve-btn').addEventListener('click', () => {
            this.showSolution();
        });
        
        // 暂停按钮
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.togglePause();
        });
        
        // 继续游戏按钮
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.togglePause();
        });
        
        // 弹窗按钮
        document.getElementById('new-game-modal-btn').addEventListener('click', () => {
            this.closeModal();
            this.generateNewGame();
        });
        
        document.getElementById('close-modal-btn').addEventListener('click', () => {
            this.closeModal();
        });

        // 帮助按钮
        document.getElementById('help-btn').addEventListener('click', () => {
            this.showHelp();
        });

        document.getElementById('close-help-btn').addEventListener('click', () => {
            this.closeHelp();
        });
    }

    showHint() {
        if (this.isPaused || this.isGameComplete) {
            return;
        }

        // 如果已经在提醒模式，取消提醒模式
        if (this.hintMode) {
            this.cancelHintMode();
            return;
        }

        // 找到所有空白单元格
        const emptyCells = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0 && this.initialGrid[row][col] === 0) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length === 0) {
            this.showMessage('没有可以提醒的空白单元格', 'info');
            return;
        }

        // 进入提醒模式
        this.hintMode = true;

        // 改变鼠标光标
        document.body.classList.add('hint-cursor');

        // 更新提醒按钮状态
        const hintBtn = document.getElementById('hint-btn');
        hintBtn.innerHTML = '<span class="btn-icon">❌</span>取消提醒';
        hintBtn.classList.add('active');

        this.showMessage('提醒模式：点击任意空白单元格获取正确答案', 'info');
    }

    cancelHintMode() {
        this.hintMode = false;
        this.hintTarget = null;

        // 恢复鼠标光标
        document.body.classList.remove('hint-cursor');

        // 恢复提醒按钮状态
        const hintBtn = document.getElementById('hint-btn');
        hintBtn.innerHTML = '<span class="btn-icon">💡</span>提醒';
        hintBtn.classList.remove('active');

        this.showMessage('已取消提醒模式', 'info');
    }

    handleHintClick(row, col) {
        if (!this.hintMode) return false;

        // 检查是否是空白单元格
        if (this.grid[row][col] !== 0 || this.initialGrid[row][col] !== 0) {
            this.showMessage('请点击空白单元格获取提醒', 'error');
            return false;
        }

        // 显示正确答案
        const correctNumber = this.solution[row][col];

        // 保存到历史记录（在修改状态之前）
        const oldValue = this.grid[row][col];
        this.saveToHistory(row, col, oldValue, correctNumber);

        this.grid[row][col] = correctNumber;

        // 标记为提醒数字
        this.hintNumbers[row][col] = true;

        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        cellElement.classList.add('hint');

        this.hintCount++;
        this.updateDisplay();
        this.updateProgress();
        this.checkGameComplete();

        // 退出提醒模式
        this.cancelHintMode();

        this.showMessage(`提醒：正确答案是 ${correctNumber}`, 'success');
        return true;
    }

    checkErrors() {
        let errorCount = 0;

        // 清除之前的错误标记
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('error');
        });

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = this.grid[row][col];
                if (value !== 0) {
                    // 临时清除当前位置的值来检查冲突
                    this.grid[row][col] = 0;
                    if (!this.isValidMove(this.grid, row, col, value)) {
                        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        cellElement.classList.add('error');
                        errorCount++;
                    }
                    this.grid[row][col] = value;
                }
            }
        }

        if (errorCount === 0) {
            this.showMessage('没有发现错误！', 'success');
        } else {
            this.showMessage(`发现 ${errorCount} 个错误，已用红色标出`, 'error');
        }
    }

    showSolution() {
        if (confirm('确定要显示答案吗？这将结束当前游戏。')) {
            this.grid = this.solution.map(row => [...row]);
            this.updateDisplay();
            this.stopTimer();
            this.isGameComplete = true;
            this.showMessage('已显示完整答案', 'info');
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pause-overlay');
        const pauseBtn = document.getElementById('pause-btn');

        if (this.isPaused) {
            pauseOverlay.style.display = 'block';
            pauseBtn.textContent = '继续';
            this.stopTimer();
        } else {
            pauseOverlay.style.display = 'none';
            pauseBtn.textContent = '暂停';
            this.startTimer();
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.isGameComplete) {
                this.timer++;
                this.updateTimerDisplay();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer').textContent = timeString;
    }

    updateProgress() {
        const filledCells = this.grid.flat().filter(cell => cell !== 0).length;
        const totalCells = 81;
        const percentage = (filledCells / totalCells) * 100;

        document.getElementById('progress-fill').style.width = `${percentage}%`;
        document.getElementById('progress-text').textContent = `${filledCells}/${totalCells}`;
    }

    checkGameComplete() {
        // 检查是否所有单元格都已填满
        const isEmpty = this.grid.some(row => row.some(cell => cell === 0));
        if (isEmpty) return false;

        // 检查是否有错误
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = this.grid[row][col];
                this.grid[row][col] = 0;
                if (!this.isValidMove(this.grid, row, col, value)) {
                    this.grid[row][col] = value;
                    return false;
                }
                this.grid[row][col] = value;
            }
        }

        // 游戏完成
        this.gameComplete();
        return true;
    }

    gameComplete() {
        this.isGameComplete = true;
        this.stopTimer();

        // 显示完成弹窗
        const modal = document.getElementById('victory-modal');
        const finalTime = document.getElementById('final-time');
        const finalDifficulty = document.getElementById('final-difficulty');
        const hintCountElement = document.getElementById('hint-count');

        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        finalTime.textContent = timeString;
        finalDifficulty.textContent = this.getDifficultyText();
        hintCountElement.textContent = this.hintCount;

        modal.style.display = 'block';

        this.showMessage('🎉 恭喜！您成功完成了数独游戏！', 'success');
    }

    getDifficultyText() {
        const difficultyMap = {
            easy: '初级',
            medium: '中级',
            hard: '高级'
        };
        return difficultyMap[this.difficulty] || '未知';
    }

    closeModal() {
        document.getElementById('victory-modal').style.display = 'none';
    }

    showNewGameConfirm() {
        document.getElementById('new-game-confirm-modal').style.display = 'block';
    }

    showHelp() {
        document.getElementById('help-modal').style.display = 'block';
    }

    closeHelp() {
        document.getElementById('help-modal').style.display = 'none';
    }

    showMessage(text, type = 'info') {
        const messageElement = document.getElementById('message');
        messageElement.textContent = text;
        messageElement.className = `message ${type}`;

        // 3秒后清除消息
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'message';
        }, 3000);
    }

    resetGame() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.initialGrid = Array(9).fill().map(() => Array(9).fill(0));
        this.hintNumbers = Array(9).fill().map(() => Array(9).fill(false)); // 重置提醒数字
        this.selectedCell = null;
        this.selectedNumber = 0; // 重置为清除按钮
        this.timer = 0;
        this.hintCount = 0;
        this.isPaused = false;
        this.isGameComplete = false;
        this.history = [];
        this.historyIndex = -1;
        this.hintMode = false;
        this.hintTarget = null;

        this.stopTimer();
        this.updateTimerDisplay();

        // 清除所有样式
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('selected', 'error', 'hint', 'given', 'invalid', 'highlight-same', 'conflict', 'hint-target', 'hint-number');
        });

        // 清除数字按钮选中状态
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 恢复提醒按钮状态
        const hintBtn = document.getElementById('hint-btn');
        hintBtn.innerHTML = '<span class="btn-icon">💡</span>提醒';
        hintBtn.classList.remove('active');

        // 更新按钮状态
        this.updateUndoRedoButtons();

        // 隐藏弹窗和遮罩
        document.getElementById('victory-modal').style.display = 'none';
        document.getElementById('pause-overlay').style.display = 'none';
        document.getElementById('pause-btn').textContent = '暂停';

        this.showMessage('', '');
    }
}

// 初始化游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new SudokuGame();
});
