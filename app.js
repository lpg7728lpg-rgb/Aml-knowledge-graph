// Data Models
let nodesData = [
    { id: 'A', label: 'Account A\n(Client)', value: 20 },
    { id: 'B', label: 'Account B\n(Shell Co 1)', value: 20 },
    { id: 'C', label: 'Account C\n(Offshore)', value: 20 },
    { id: 'D', label: 'Account D\n(Shell Co 2)', value: 20 }
];

let edgesData = [];
// Using datasets from vis so we can update them dynamically
let nodes = new vis.DataSet(nodesData);
let edges = new vis.DataSet(edgesData);

// Network Initialization
const container = document.getElementById('mynetwork');
const data = { nodes: nodes, edges: edges };
const options = {
    nodes: {
        shape: 'dot',
        scaling: {
            min: 10,
            max: 30
        },
        font: {
            size: 14,
            color: '#e2e8f0',
            face: 'Inter',
            multi: 'html'
        },
        borderWidth: 2,
        color: {
            border: '#3b82f6',
            background: '#1e293b',
            highlight: {
                border: '#60a5fa',
                background: '#1e293b'
            }
        },
        shadow: {
            enabled: true,
            color: 'rgba(59, 130, 246, 0.3)',
            size: 10,
            x: 0,
            y: 0
        }
    },
    edges: {
        width: 2,
        arrows: {
            to: { enabled: true, scaleFactor: 0.5 }
        },
        color: {
            color: '#64748b',
            highlight: '#94a3b8',
            hover: '#94a3b8'
        },
        smooth: {
            type: 'curvedCW',
            roundness: 0.2
        }
    },
    physics: {
        forceAtlas2Based: {
            gravitationalConstant: -100,
            centralGravity: 0.01,
            springLength: 150,
            springConstant: 0.08
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
    },
    interaction: {
        hover: true,
        tooltipDelay: 200
    }
};

let network = new vis.Network(container, data, options);

// UI Elements
const logContainer = document.getElementById('log-container');
const alertBox = document.getElementById('alert-box');
const riskLevel = document.getElementById('risk-level');
const systemStatus = document.getElementById('system-status');

// State
let transactionCount = 0;
let nodeCounter = 69; // ASCII for E

// Add Log Function
function addLog(from, to, amount, isSuspicious = false) {
    const time = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = `log-item ${isSuspicious ? 'suspicious' : ''}`;
    
    logItem.innerHTML = `
        <div class="log-details">
            <strong>${from}</strong> &rarr; <strong>${to}</strong>
            <div class="log-amount" style="color: ${isSuspicious ? 'var(--risk-high)' : '#10b981'}; font-weight: bold; margin-top:4px;">
                $${amount.toLocaleString()}
            </div>
        </div>
        <div class="log-time">${time}</div>
    `;
    
    logContainer.prepend(logItem); // Add to top
}

// Transaction Function
function processTransaction(fromId, toId, amount = 1000) {
    let isSuspicious = false;
    
    // Check if edge already exists to just update properties, or create new
    const edgeId = `${fromId}-${toId}`;
    const existingEdges = edges.get({
        filter: function (item) {
            return item.from === fromId && item.to === toId;
        }
    });

    if (existingEdges.length > 0) {
        // Edge exists, pulse it
        animateEdge(existingEdges[0].id);
    } else {
        // Create new edge
        edges.add({
            id: edgeId,
            from: fromId,
            to: toId,
            label: `$${amount}`,
            font: { color: '#94a3b8', size: 12, align: 'top' },
            title: `Transaction: $${amount}`
        });
        animateEdge(edgeId);
    }

    addLog(fromId, toId, amount, isSuspicious);
    
    // Run fraud detection after a slight delay so visual edge hits first
    setTimeout(() => {
        detectFraud();
    }, 500);
}

// Edge Animation
function animateEdge(edgeId) {
    const currentEdge = edges.get(edgeId);
    if (!currentEdge) return;

    const originalColor = currentEdge.color || { color: '#64748b' };
    const originalWidth = currentEdge.width || 2;
    
    edges.update({
        id: edgeId,
        color: { color: '#10b981' }, // Green for transaction
        width: 4
    });
    
    setTimeout(() => {
        // Restore if it wasn't marked red by fraud detection
        const updatedEdge = edges.get(edgeId);
        if (updatedEdge && (!updatedEdge.color || updatedEdge.color.color !== '#ef4444')) {
            edges.update({
                id: edgeId,
                color: originalColor,
                width: originalWidth
            });
        }
    }, 1000);
}

// Cycle Detection using DFS
function detectCycles() {
    const allNodes = nodes.getIds();
    const adjList = {};
    allNodes.forEach(n => adjList[n] = []);
    
    const allEdges = edges.get();
    allEdges.forEach(e => {
        adjList[e.from].push({to: e.to, edgeId: e.id});
    });

    const cycles = [];
    
    function dfs(node, visited, path, edgePath) {
        visited[node] = true;
        path.push(node);
        
        for (let i = 0; i < adjList[node].length; i++) {
            const neighbor = adjList[node][i].to;
            const usingEdgeId = adjList[node][i].edgeId;
            
            const neighborIdx = path.indexOf(neighbor);
            if (neighborIdx !== -1) {
                // Cycle found
                const cycleNodes = path.slice(neighborIdx);
                const cycleEdges = [...edgePath, usingEdgeId].slice(neighborIdx);
                cycles.push({nodes: cycleNodes, edges: cycleEdges});
            } else if (!visited[neighbor]) {
                dfs(neighbor, {...visited}, [...path], [...edgePath, usingEdgeId]);
            }
        }
    }

    allNodes.forEach(n => {
        dfs(n, {}, [], []);
    });
    
    // Deduplicate cycles (simple approach based on sets of nodes)
    const uniqueCyclesMap = {};
    const uniqueCycles = [];
    cycles.forEach(c => {
        const sortedNodes = [...c.nodes].sort().join(',');
        if (!uniqueCyclesMap[sortedNodes]) {
            uniqueCyclesMap[sortedNodes] = true;
            uniqueCycles.push(c);
        }
    });

    return uniqueCycles;
}

// Fraud Detection Logic
function detectFraud() {
    const cycles = detectCycles();
    
    if (cycles.length > 0) {
        // Highlight cycles
        cycles.forEach(cycle => {
            cycle.nodes.forEach(nId => {
                nodes.update({
                    id: nId,
                    color: {
                        border: '#ef4444',
                        background: '#3f1118',
                        highlight: { border: '#ef4444', background: '#3f1118' }
                    },
                    shadow: { color: 'rgba(239, 68, 68, 0.6)' }
                });
            });
            
            cycle.edges.forEach(eId => {
                edges.update({
                    id: eId,
                    color: { color: '#ef4444' },
                    width: 4,
                    shadow: { enabled: true, color: 'rgba(239, 68, 68, 0.6)', size: 5 }
                });
            });
        });
        
        // Update UI
        riskLevel.innerText = 'HIGH';
        riskLevel.className = 'risk-high';
        alertBox.classList.remove('hidden');
        
        systemStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Alert Active';
        systemStatus.style.color = 'var(--risk-high)';
        systemStatus.style.background = 'rgba(239, 68, 68, 0.1)';
        systemStatus.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else {
        // Normal state
        const numEdges = edges.length;
        if (numEdges > 10) {
            riskLevel.innerText = 'MEDIUM';
            riskLevel.className = 'risk-medium';
        } else {
            riskLevel.innerText = 'LOW';
            riskLevel.className = 'risk-low';
        }
    }
}

// Buttons Event Listeners

// Run Transaction Simulation: A -> B -> C -> D -> A
document.getElementById('sim-btn').addEventListener('click', () => {
    // Check if D to A already exists to prevent crazy loop overlap issues dynamically
    
    const sequence = [
        { from: 'A', to: 'B', delay: 0 },
        { from: 'B', to: 'C', delay: 1500 },
        { from: 'C', to: 'D', delay: 3000 },
        { from: 'D', to: 'A', delay: 4500 }
    ];
    
    sequence.forEach(step => {
        setTimeout(() => {
            processTransaction(step.from, step.to, 1000);
        }, step.delay);
    });
});

// Add Node Dynamically
document.getElementById('add-node-btn').addEventListener('click', () => {
    const id = String.fromCharCode(nodeCounter++);
    nodes.add({
        id: id,
        label: `Account ${id}`,
        value: 20
    });
});

// Random Transaction
document.getElementById('random-tx-btn').addEventListener('click', () => {
    const allNodes = nodes.getIds();
    if (allNodes.length < 2) return;
    
    // Pick two distinct random nodes
    const fromIdx = Math.floor(Math.random() * allNodes.length);
    let toIdx = Math.floor(Math.random() * allNodes.length);
    while (toIdx === fromIdx) {
        toIdx = Math.floor(Math.random() * allNodes.length);
    }
    
    const fromId = allNodes[fromIdx];
    const toId = allNodes[toIdx];
    const amount = Math.floor(Math.random() * 900) * 10 + 1000; // 1000 to 10000
    
    processTransaction(fromId, toId, amount);
});
