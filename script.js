// Constants
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// DOM Elements
const projectForm = document.getElementById('projectForm');
const outputSection = document.getElementById('outputSection');

// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

// Add this to the existing constants
let currentProjects = [];

// Add this after your existing constants
let projectScope = 'materials'; // Default mode

// Add this function to handle materials toggle
function initializeMaterialsToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const materialsInput = document.getElementById('materialsInput');

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Update materials mode
            projectScope = button.dataset.scope;
            
            // Show/hide materials input
            if (projectScope === 'materials') {
                materialsInput.classList.add('hidden');
            } else {
                materialsInput.classList.remove('hidden');
            }
        });
    });
}

// Add this function to handle scope toggle
function initializeScopeToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const materialsInput = document.getElementById('materialsInput');
    const topicsInput = document.getElementById('topicsInput');

    function updateInputVisibility(scope) {
        materialsInput.classList.add('hidden');
        topicsInput.classList.add('hidden');

        if (scope === 'materials') {
            materialsInput.classList.remove('hidden');
        } else if (scope === 'topics') {
            topicsInput.classList.remove('hidden');
        }
    }

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            projectScope = button.dataset.scope;
            updateInputVisibility(projectScope);
        });
    });
}

// Helper function to create the initial prompt for project list
function createListPrompt(formData) {
    let scopeText = '';
    switch (projectScope) {
        case 'materials':
            scopeText = `Materials Available: ${formData.materials}`;
            break;
        case 'topics':
            scopeText = `Project Topics/Themes: ${formData.topics}
            Focus on creating projects related to these topics/themes.`;
            break;
        case 'random':
            scopeText = `Use any commonly available materials and choose diverse project categories.`;
            break;
    }

    return `Generate 5 DIFFERENT and UNIQUE DIY project ideas based on the following criteria:
    ${scopeText}
    Difficulty Level: ${formData.difficulty}
    Timeframe: ${formData.timeframe}
    Skill Level: ${formData.skillLevel}

    Important Guidelines:
    1. Each project MUST be completely different in purpose and final result
    2. Use a wide variety of project categories (e.g., furniture, decor, garden, storage, lighting, toys, art, organization, outdoor, indoor)
    3. Ensure projects serve different functions and purposes
    4. Avoid suggesting multiple projects from the same category
    5. Make each project title unique and descriptive
    ${projectScope === 'random' ? '6. Suggest common and easily accessible materials for each project.' : ''}
    ${projectScope === 'topics' ? '6. Ensure projects align with the specified topics/themes while maintaining variety.' : ''}

    Please provide a response in the following JSON format:
    {
        "projects": [
            {
                "id": 1,
                "title": "Project title",
                "shortDescription": "Brief 1-2 sentence description",
                "category": "Project category (e.g., furniture, decor, garden, storage, lighting, etc.)"
            },
            // ... repeat for all 5 projects
        ]
    }`;
}

// Helper function to create the prompt for detailed project
function createDetailedPrompt(projectTitle, formData) {
    return `Generate detailed instructions for the DIY project "${projectTitle}" considering:
    Materials Available: ${formData.materials}
    Difficulty Level: ${formData.difficulty}
    Timeframe: ${formData.timeframe}
    Skill Level: ${formData.skillLevel}

    Please provide a response in the following JSON format:
    {
        "projectIdea": "${projectTitle}",
        "abstract": "Detailed project description",
        "materialsList": ["List of all required materials"],
        "methodology": ["Step-by-step instructions"]
    }`;
}

// Function to make API call to Groq
async function callAIAPI(prompt) {
    try {
        const response = await fetch('/.netlify/functions/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        return JSON.parse(data.content);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Function to display project list
function displayProjectList(projects, append = false) {
    const outputContainer = document.querySelector('.output-container');
    
    if (!append) {
        currentProjects = [];
        outputContainer.innerHTML = `
            <div class="project-list">
                <h3>Choose a Project</h3>
                <div class="project-options"></div>
                <button class="show-more-btn">Show More Projects</button>
            </div>
        `;
    }

    currentProjects = [...currentProjects, ...projects];
    
    const projectOptions = outputContainer.querySelector('.project-options');
    projectOptions.innerHTML = currentProjects.map(project => `
        <div class="project-option" data-project-id="${project.id}">
            <div class="project-category">${project.category}</div>
            <h4>${project.title}</h4>
            <p>${project.shortDescription}</p>
            <button class="select-project-btn">Select This Project</button>
        </div>
    `).join('');

    // Add event listeners to select buttons
    document.querySelectorAll('.select-project-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const projectOption = e.target.closest('.project-option');
            const projectTitle = projectOption.querySelector('h4').textContent;
            await getDetailedProject(projectTitle);
        });
    });

    // Add event listener to show more button
    const showMoreBtn = outputContainer.querySelector('.show-more-btn');
    showMoreBtn.addEventListener('click', async () => {
        showMoreBtn.classList.add('loading');
        showMoreBtn.textContent = 'Loading More Projects...';
        try {
            await generateProjectList(true);
        } finally {
            showMoreBtn.classList.remove('loading');
            showMoreBtn.textContent = 'Show More Projects';
        }
    });

    outputSection.style.display = 'block';
}

// Function to get and display detailed project
async function getDetailedProject(projectTitle) {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.classList.add('loading');
    
    const formData = {
        materials: document.getElementById('materials').value,
        difficulty: document.getElementById('difficulty').value,
        timeframe: document.getElementById('timeframe').value,
        skillLevel: document.getElementById('skillLevel').value
    };

    try {
        const prompt = createDetailedPrompt(projectTitle, formData);
        const results = await callAIAPI(prompt);
        displayDetailedResults(results);
        projectForm.dataset.results = JSON.stringify(results);
    } catch (error) {
        alert('Failed to get project details. Please try again.');
    } finally {
        submitBtn.classList.remove('loading');
    }
}

// Function to display detailed results
function displayDetailedResults(results) {
    const outputContainer = document.querySelector('.output-container');
    outputContainer.innerHTML = `
        <div class="output-block">
            <h3>Project Idea</h3>
            <div id="projectIdea">${results.projectIdea}</div>
        </div>
        <div class="output-block">
            <h3>Abstract</h3>
            <div id="abstract">${results.abstract}</div>
        </div>
        <div class="output-block">
            <h3>Materials List</h3>
            <div id="materialsList">
                <ul>${results.materialsList.map(item => `<li>${item}</li>`).join('')}</ul>
            </div>
        </div>
        <div class="output-block">
            <h3>Methodology</h3>
            <div id="methodology">
                <ol>${results.methodology.map(step => `<li>${step}</li>`).join('')}</ol>
            </div>
        </div>
        <div class="button-group">
            <button class="back-to-list-btn">Back to Project List</button>
            <button class="download-btn">Download PDF</button>
        </div>
    `;

    // Add event listeners
    document.querySelector('.back-to-list-btn').addEventListener('click', () => {
        displayProjectList(currentProjects);
    });
    
    document.querySelector('.download-btn').addEventListener('click', () => {
        generatePDF(results);
    });
}

// Update the areProjectsUnique function
function areProjectsUnique(newProjects, existingProjects = []) {
    // Create sets for checking uniqueness
    const titles = new Set();
    const categories = new Map(); // Using Map to track category counts
    const keywords = new Set();

    // Helper function to extract keywords from text
    function getKeywords(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3); // Only consider words longer than 3 characters
    }

    // Process existing projects first
    existingProjects.forEach(project => {
        titles.add(project.title.toLowerCase());
        
        // Track category count
        const category = project.category.toLowerCase();
        categories.set(category, (categories.get(category) || 0) + 1);
        
        // Add keywords from title and description
        getKeywords(project.title).forEach(keyword => keywords.add(keyword));
        getKeywords(project.shortDescription).forEach(keyword => keywords.add(keyword));
    });

    // Check new projects
    for (const project of newProjects) {
        const titleLower = project.title.toLowerCase();
        const categoryLower = project.category.toLowerCase();
        const titleKeywords = getKeywords(project.title);
        const descKeywords = getKeywords(project.shortDescription);

        // Check for exact title matches
        if (titles.has(titleLower)) {
            return false;
        }

        // Check for category distribution (allow max 2 projects per category)
        const categoryCount = categories.get(categoryLower) || 0;
        if (categoryCount >= 2) {
            return false;
        }

        // Check for keyword overlap (allow some overlap but not too much)
        let keywordOverlapCount = 0;
        [...titleKeywords, ...descKeywords].forEach(keyword => {
            if (keywords.has(keyword)) {
                keywordOverlapCount++;
            }
        });

        // If more than 30% of keywords overlap, consider it too similar
        const totalKeywords = titleKeywords.length + descKeywords.length;
        if (totalKeywords > 0 && (keywordOverlapCount / totalKeywords) > 0.3) {
            return false;
        }

        // Update tracking sets/maps with this project
        titles.add(titleLower);
        categories.set(categoryLower, categoryCount + 1);
        titleKeywords.forEach(keyword => keywords.add(keyword));
        descKeywords.forEach(keyword => keywords.add(keyword));
    }

    return true;
}

// Modify the generateProjectList function
async function generateProjectList(append = false) {
    const formData = {
        materials: projectScope === 'materials' ? document.getElementById('materials').value : '',
        topics: projectScope === 'topics' ? document.getElementById('topics').value : '',
        difficulty: document.getElementById('difficulty').value,
        timeframe: document.getElementById('timeframe').value,
        skillLevel: document.getElementById('skillLevel').value
    };

    try {
        let attempts = 0;
        let uniqueProjects = null;
        
        while (attempts < 3) {
            const prompt = createListPrompt(formData);
            const results = await callAIAPI(prompt);
            
            // Check if projects are unique
            if (areProjectsUnique(results.projects, currentProjects)) {
                uniqueProjects = results.projects;
                break;
            }
            
            attempts++;
        }

        if (!uniqueProjects) {
            throw new Error('Failed to generate unique projects after multiple attempts');
        }

        displayProjectList(uniqueProjects, append);
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate unique projects. Please try again with different criteria.');
    }
}

// Event Listeners
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = projectForm.querySelector('.submit-btn');
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Generating Projects...';
    
    try {
        await generateProjectList();
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Generate Projects';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializeMaterialsToggle();
    initializeScopeToggle();
});