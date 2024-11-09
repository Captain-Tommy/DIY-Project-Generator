const fetch = require('node-fetch');

// List of available providers with their endpoints
const PROVIDERS = [
    {
        url: 'https://free.churchless.tech/v1/chat/completions',
        name: 'Churchless'
    },
    {
        url: 'https://api.openai-proxy.com/v1/chat/completions',
        name: 'OpenAI Proxy'
    },
    {
        url: 'https://api.freegpt4.ddns.net/chat/completions',
        name: 'FreeGPT4'
    },
    {
        url: 'https://api.freegpt.one/v1/chat/completions',
        name: 'FreeGPT One'
    },
    {
        url: 'https://ai.fakeopen.com/v1/chat/completions',
        name: 'FakeOpen'
    },
    {
        url: 'https://api.chatanywhere.cn/v1/chat/completions',
        name: 'ChatAnywhere'
    },
    {
        url: 'https://api.gpt4.org/v1/chat/completions',
        name: 'GPT4.org'
    }
];

// Function to check project similarity (less strict)
function areSimilarProjects(project1, project2) {
    const title1 = project1.title.toLowerCase();
    const title2 = project2.title.toLowerCase();
    
    // Check for exact title match
    if (title1 === title2) return true;

    // Get keywords from titles
    const getKeywords = (text) => {
        return text.replace(/[^\w\s]/g, '')
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3);
    };

    const keywords1 = new Set(getKeywords(title1));
    const keywords2 = new Set(getKeywords(title2));

    // Count matching keywords
    let matches = 0;
    for (const word of keywords1) {
        if (keywords2.has(word)) matches++;
    }

    // If more than 50% of keywords match, consider them similar
    const similarity = matches / Math.min(keywords1.size, keywords2.size);
    return similarity > 0.5;
}

// Function to merge project lists while maintaining uniqueness
function mergeUniqueProjects(projectLists) {
    const uniqueProjects = [];
    let currentId = 1;

    for (const list of projectLists) {
        if (!Array.isArray(list)) continue;

        for (const project of list) {
            // Check if a similar project already exists
            const hasSimilar = uniqueProjects.some(existing => 
                areSimilarProjects(existing, project)
            );

            if (!hasSimilar) {
                uniqueProjects.push({
                    ...project,
                    id: currentId++
                });
            }
        }
    }

    return uniqueProjects;
}

async function tryProvider(provider, prompt) {
    try {
        console.log(`Trying provider: ${provider.name}`);
        const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a DIY project expert. Always respond in the exact JSON format requested by the user.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            }),
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`${provider.name} request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error(`Invalid response format from ${provider.name}`);
        }

        try {
            const parsed = JSON.parse(data.choices[0].message.content);
            return parsed.projects || [];
        } catch (jsonError) {
            console.error(`Invalid JSON from ${provider.name}:`, data.choices[0].message.content);
            return [];
        }
    } catch (error) {
        console.error(`Error with provider ${provider.name}:`, error);
        return [];
    }
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const { prompt } = JSON.parse(event.body);
    
    // Make concurrent requests to all providers
    const projectPromises = PROVIDERS.map(provider => tryProvider(provider, prompt));
    const results = await Promise.allSettled(projectPromises);
    
    // Collect all successful responses
    const allProjects = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(projects => Array.isArray(projects));

    // Merge and deduplicate projects
    const uniqueProjects = mergeUniqueProjects(allProjects);

    if (uniqueProjects.length === 0) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to generate projects from all providers'
            })
        };
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
            content: JSON.stringify({ projects: uniqueProjects })
        })
    };
}; 