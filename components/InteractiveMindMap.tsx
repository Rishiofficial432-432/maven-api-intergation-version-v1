import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, X, Plus } from 'lucide-react';
import { geminiAI } from './gemini';
import { Spinner } from './Spinner';

// Helper function for text wrapping
function wrapText(text: string, maxWidthChars: number): string[] {
    const words = text.split(' ');
    // Handle single long words by splitting them
    if (words.length === 1 && text.length > maxWidthChars) {
        const chunks = [];
        for (let i = 0; i < text.length; i += maxWidthChars) {
            chunks.push(text.substring(i, i + maxWidthChars));
        }
        return chunks;
    }

    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > maxWidthChars && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

// Reusable dimension calculator
const calculateNodeDimensions = (text: string): { width: number; height: number; lines: string[] } => {
    const lineHeight = 18;
    const padding = { x: 16, y: 12 };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '-9999px';
    svg.style.left = '-9999px';
    document.body.appendChild(svg);
    
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('font-size', '14px');
    textElement.setAttribute('font-weight', '500');
    svg.appendChild(textElement);

    const lines = wrapText(text, 25);
    
    let maxWidth = 0;
    lines.forEach(line => {
        textElement.textContent = line;
        const bbox = textElement.getBBox();
        if (bbox.width > maxWidth) {
            maxWidth = bbox.width;
        }
    });

    document.body.removeChild(svg);

    const width = maxWidth + padding.x * 2;
    const height = lines.length * lineHeight + padding.y * 2;
    
    return { width, height, lines };
};


// Type Definitions
interface MindMapNodeData {
  id: number;
  text: string;
  x: number;
  y: number;
  level: number;
  color: string;
  parentId?: number;
  width: number;
  height: number;
  lines: string[];
}

interface MindMapConnection {
  from: number;
  to: number;
}

interface MindMapData {
  nodes: MindMapNodeData[];
  connections: MindMapConnection[];
  title: string;
}

const generateMindMap = (content: string, title: string): MindMapData => {
    const allLines = content.split('\n').filter(line => line.trim() !== '');
    
    const rootText = allLines.length > 0 
        ? allLines.shift()!.trim().replace(/^[*-]\s*/, '') 
        : title.replace(/\.[^/.]+$/, "");
    
    const lines = allLines;

    const nodes: MindMapNodeData[] = [];
    const connections: MindMapConnection[] = [];
    let idCounter = 0;
    
    const rootNode: Omit<MindMapNodeData, 'width' | 'height' | 'lines'> = {
        id: idCounter++,
        text: rootText,
        x: 0,
        y: 0,
        level: 0,
        color: '#4B5563',
    };
    nodes.push(rootNode as MindMapNodeData);
    
    const parentStack: MindMapNodeData[] = [rootNode as MindMapNodeData];

    lines.forEach(line => {
        const indent = line.search(/\S|$/);
        const level = Math.floor(indent / 2) + 1;
        const text = line.trim().replace(/^[*-]\s*/, '');

        if (!text) return;

        while (level < parentStack.length) {
            parentStack.pop();
        }
        const parent = parentStack[parentStack.length - 1];

        const pastelPalette = ['#60A5FA', '#FBBF24', '#4ADE80', '#F87171', '#A78BFA'];
        const color = level === 1 
            ? pastelPalette[nodes.filter(n => n.level === 1).length % pastelPalette.length] 
            : '#374151';

        const newNode: Omit<MindMapNodeData, 'width' | 'height' | 'lines'> = {
            id: idCounter++,
            text,
            x: 0,
            y: 0,
            level,
            color,
            parentId: parent.id,
        };
        nodes.push(newNode as MindMapNodeData);
        connections.push({ from: parent.id, to: newNode.id });
        parentStack.push(newNode as MindMapNodeData);
    });

    nodes.forEach(node => {
        const { width, height, lines } = calculateNodeDimensions(node.text);
        Object.assign(node, { width, height, lines });
    });


    const positionNodes = (rootId: number, startAngle: number, endAngle: number) => {
        const children = nodes.filter(n => n.parentId === rootId);
        if (children.length === 0) return;

        const parentNode = nodes.find(n => n.id === rootId)!;
        const angleStep = (endAngle - startAngle) / children.length;

        children.forEach((child, index) => {
            const angle = startAngle + (index + 0.5) * angleStep;
            const radius = 100 + parentNode.width / 2 + child.width / 2 + (child.level * 40);

            child.x = parentNode.x + Math.cos(angle) * radius;
            child.y = parentNode.y + Math.sin(angle) * radius;
            
            positionNodes(child.id, angle - angleStep / 2, angle + angleStep / 2);
        });
    };

    positionNodes(0, 0, 2 * Math.PI);

    return { nodes, connections, title };
};

const simulatePDFExtraction = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `PDF Document Analysis: ${file.name}
- Business Strategy
  - Market Analysis
    - Competitive landscape
    - Market size and trends
    - Customer segments
  - Financial Planning
    - Revenue projections
    - Cost analysis
    - ROI calculations
- Implementation Strategy
  - Timeline and milestones
  - Resource allocation
  - Risk assessment
`;
};

const simulateWordExtraction = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    return `Word Document Content: ${file.name}
- Project Overview: Software Development
  - Requirements Analysis
    - Functional requirements
    - Non-functional requirements
  - System Design
    - Architecture overview
    - Database design
  - Development Process
    - Technology stack
    - Quality assurance
`;
};

const simulatePPTExtraction = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    return `Presentation Summary: ${file.name}
- Marketing Campaign Strategy
  - Target Audience
    - Demographics analysis
    - Psychographics profile
  - Campaign Objectives
    - Brand awareness goals
    - Lead generation targets
  - Channel Strategy
    - Digital marketing channels
    - Social media platforms
`;
};


// Main Component
const InteractiveMindMap: React.FC = () => {
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewBox, setViewBox] = useState({ x: -400, y: -300, width: 800, height: 600 });
  
  const [selectedNode, setSelectedNode] = useState<MindMapNodeData | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  
  const [draggingNode, setDraggingNode] = useState<{ id: number; offset: { x: number; y: number } } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [tempNodeText, setTempNodeText] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);

  const resetView = () => {
    setZoom(1);
    const initialViewBox = { x: -400, y: -300, width: 800, height: 600 };
    setViewBox(initialViewBox);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMindMapData(null);
    setSelectedNode(null);
    setExplanation('');
    setDocumentFile(file);

    try {
      let content = '';
      const fileName = file.name.toLowerCase();

      if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
          content = await simulatePDFExtraction(file);
      } else if (
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/msword' ||
          fileName.endsWith('.docx') ||
          fileName.endsWith('.doc')
      ) {
          content = await simulateWordExtraction(file);
      } else if (
          file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.type === 'application/vnd.ms-powerpoint' ||
          fileName.endsWith('.pptx') ||
          fileName.endsWith('.ppt')
      ) {
          content = await simulatePPTExtraction(file);
      } else {
          content = await file.text();
      }

      const mindMap = generateMindMap(content, file.name);
      setMindMapData(mindMap);
      resetView();
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. The format may not be fully supported.');
    } finally {
        setIsProcessing(false);
    }
  };

    const handleNodeClick = async (node: MindMapNodeData) => {
        if (selectedNode?.id === node.id) {
            setSelectedNode(null);
            setExplanation('');
            return;
        }
        if (editingNodeId) return;

        setSelectedNode(node);
        setExplanation('');
        setIsExplaining(true);
        
        if (!geminiAI) {
            setExplanation("AI features are disabled. API key not found.");
            setIsExplaining(false);
            return;
        }

        try {
            const context = mindMapData?.nodes
                .filter(n => n.parentId === node.parentId || n.id === node.parentId || n.parentId === node.id)
                .map(n => n.text)
                .join(', ');
            
            const prompt = `In the context of a mind map about "${mindMapData?.title}", briefly explain the concept of "${node.text}". Related concepts include: ${context}. Keep the explanation to 2-3 sentences.`;
            
            const response = await geminiAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            const responseText = response.text.trim();
            setExplanation(responseText);
        } catch (err) {
            console.error("Failed to get explanation:", err);
            setExplanation("Sorry, I couldn't generate an explanation for this topic.");
        } finally {
            setIsExplaining(false);
        }
    };

    const handleNodeDoubleClick = (node: MindMapNodeData) => {
        setEditingNodeId(node.id);
        setTempNodeText(node.text);
        setSelectedNode(null); // Deselect to hide sidebar during editing
    };

    const handleNodeTextSave = () => {
        if (editingNodeId === null) return;
        const originalNode = mindMapData?.nodes.find(n => n.id === editingNodeId);

        setMindMapData(prev => {
            if (!prev) return null;
            const newText = tempNodeText.trim();
            if (!newText || newText === originalNode?.text) return prev;

            const { width, height, lines } = calculateNodeDimensions(newText);

            return {
                ...prev,
                nodes: prev.nodes.map(n => 
                    n.id === editingNodeId 
                    ? { ...n, text: newText, width, height, lines } 
                    : n
                )
            };
        });
        setEditingNodeId(null);
    };

    const handleAddNode = () => {
        if (!selectedNode || !mindMapData) return;
        const parentNode = selectedNode;
        const newId = Math.max(...mindMapData.nodes.map(n => n.id)) + 1;
        const text = 'New Idea';
        const { width, height, lines } = calculateNodeDimensions(text);
        
        const angle = Math.random() * 2 * Math.PI;
        const radius = 100 + parentNode.width / 2;
        const x = parentNode.x + Math.cos(angle) * radius;
        const y = parentNode.y + Math.sin(angle) * radius;

        const newNode: MindMapNodeData = {
            id: newId, text, x, y, level: parentNode.level + 1, color: '#374151',
            parentId: parentNode.id, width, height, lines
        };
        const newConnection: MindMapConnection = { from: parentNode.id, to: newId };
        
        setMindMapData(prev => ({
            ...prev!,
            nodes: [...prev!.nodes, newNode],
            connections: [...prev!.connections, newConnection]
        }));
        setSelectedNode(newNode); // Select new node for easy chaining
    };

    const handleColorChange = (color: string) => {
        if (!selectedNode || !mindMapData) return;
        
        const updatedNode = { ...selectedNode, color };
        setMindMapData(prev => ({
            ...prev!,
            nodes: prev!.nodes.map(n => n.id === selectedNode.id ? updatedNode : n)
        }));
        setSelectedNode(updatedNode);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        setZoom(Math.max(0.1, Math.min(5, newZoom)));
    };

    const handleNodeMouseDown = (e: React.MouseEvent, node: MindMapNodeData) => {
        e.stopPropagation();
        if (svgRef.current) {
            const CTM = svgRef.current.getScreenCTM();
            if (CTM) {
                const svgPoint = svgRef.current.createSVGPoint();
                svgPoint.x = e.clientX;
                svgPoint.y = e.clientY;
                const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                setDraggingNode({ id: node.id, offset: { x: node.x - transformedPoint.x, y: node.y - transformedPoint.y } });
            }
        }
    };

    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (e.target === svgRef.current && editingNodeId === null) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingNode && svgRef.current) {
            e.preventDefault();
            const CTM = svgRef.current.getScreenCTM();
            if (CTM) {
                const svgPoint = svgRef.current.createSVGPoint();
                svgPoint.x = e.clientX;
                svgPoint.y = e.clientY;
                const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                
                setMindMapData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        nodes: prev.nodes.map(n =>
                            n.id === draggingNode.id
                                ? { ...n, x: transformedPoint.x + draggingNode.offset.x, y: transformedPoint.y + draggingNode.offset.y }
                                : n
                        ),
                    };
                });
            }
        } else if (isPanning) {
            const dx = (e.clientX - panStart.x) / zoom;
            const dy = (e.clientY - panStart.y) / zoom;
            setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
        }
    };
    
    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingNode(null);
    };

    const getConnectionPath = (fromNode: MindMapNodeData, toNode: MindMapNodeData) => {
        return `M ${fromNode.x},${fromNode.y} C ${fromNode.x},${(fromNode.y + toNode.y) / 2} ${toNode.x},${(fromNode.y + toNode.y) / 2} ${toNode.x},${toNode.y}`;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden">
            <header className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-primary"/>
                    <div>
                        <h1 className="text-lg font-bold">DocuMind</h1>
                        <p className="text-xs text-muted-foreground -mt-1">{documentFile?.name || "Upload a document to start"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-secondary rounded-md p-1">
                        <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-1.5 hover:bg-accent rounded-md"><ZoomIn size={16}/></button>
                        <button onClick={resetView} className="p-1.5 hover:bg-accent rounded-md"><RotateCcw size={16}/></button>
                        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} className="p-1.5 hover:bg-accent rounded-md"><ZoomOut size={16}/></button>
                    </div>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer">
                        <Upload size={16} />
                        <span>Upload File</span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx" />
                    </label>
                </div>
            </header>
            <div className="flex-1 flex min-h-0">
                <main className="flex-1 relative bg-grid-pattern">
                    {isProcessing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                            <Spinner />
                            <p className="mt-4 text-lg">Analyzing document...</p>
                        </div>
                    ) : !mindMapData ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center p-8 bg-card/80 border border-border rounded-lg shadow-xl">
                                <FileText size={48} className="mx-auto text-muted-foreground mb-4"/>
                                <h2 className="text-2xl font-bold">Visualize Your Documents</h2>
                                <p className="text-muted-foreground mt-2">Upload a document (.txt, .md, .pdf, .docx, .pptx) to generate an interactive mind map.</p>
                            </div>
                        </div>
                    ) : (
                        <svg
                            ref={svgRef}
                            className="w-full h-full cursor-grab active:cursor-grabbing"
                            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width / zoom} ${viewBox.height / zoom}`}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <g>
                                {mindMapData.connections.map(conn => {
                                    const fromNode = mindMapData.nodes.find(n => n.id === conn.from);
                                    const toNode = mindMapData.nodes.find(n => n.id === conn.to);
                                    if (!fromNode || !toNode) return null;
                                    return (
                                        <path
                                            key={`${conn.from}-${conn.to}`}
                                            d={getConnectionPath(fromNode, toNode)}
                                            stroke="#4B5563"
                                            strokeWidth="2"
                                            fill="none"
                                        />
                                    );
                                })}
                                {mindMapData.nodes.map(node => (
                                   (editingNodeId === node.id) ? (
                                        <foreignObject 
                                            key={`edit-${node.id}`} 
                                            x={node.x - node.width / 2} 
                                            y={node.y - node.height / 2}
                                            width={node.width}
                                            height={node.height}
                                            style={{ overflow: 'visible' }}
                                        >
                                            <textarea
                                                value={tempNodeText}
                                                onChange={e => setTempNodeText(e.target.value)}
                                                onBlur={handleNodeTextSave}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNodeTextSave(); }
                                                    if (e.key === 'Escape') { setEditingNodeId(null); }
                                                }}
                                                autoFocus
                                                style={{
                                                    width: '100%', height: '100%', border: '2px solid #A78BFA', borderRadius: '8px',
                                                    background: node.color, color: 'white', textAlign: 'center', fontSize: '14px',
                                                    fontWeight: 500, padding: '6px', resize: 'none', outline: 'none',
                                                    fontFamily: 'inherit', lineHeight: '1.2', overflowY: 'hidden'
                                                }}
                                            />
                                        </foreignObject>
                                    ) : (
                                        // FIX: Replaced invalid `title` attribute on SVG `<g>` element with a `<title>` child element for tooltip.
                                        <g key={node.id} transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`} className="cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} onClick={() => handleNodeClick(node)} onDoubleClick={() => handleNodeDoubleClick(node)}>
                                            <title>Double-click to edit</title>
                                            <rect width={node.width} height={node.height} rx="8" fill={node.color} stroke={selectedNode?.id === node.id ? '#A78BFA' : '#1F2937'} strokeWidth="3" />
                                            <text x={node.width/2} y={node.height/2 - (node.lines.length-1)*18/2} dy=".3em" textAnchor="middle" fontSize="14px" fontWeight="500" fill="white" className="select-none" style={{ pointerEvents: 'none' }}>
                                                {node.lines.map((line, i) => <tspan key={i} x={node.width/2} dy={i > 0 ? '1.2em' : 0}>{line}</tspan>)}
                                            </text>
                                        </g>
                                    )
                                ))}
                            </g>
                        </svg>
                    )}
                </main>
                <aside className={`flex-shrink-0 border-l border-border transition-all duration-300 overflow-hidden ${selectedNode ? 'w-80' : 'w-0'}`}>
                    {selectedNode && (
                        <div className="p-4 flex flex-col h-full">
                             <div className="flex items-start justify-between mb-4">
                                <h3 className="font-bold text-lg flex items-center gap-2"><BrainCircuit size={18}/> Controls & AI</h3>
                                <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-accent rounded-md"><X size={16}/></button>
                            </div>
                            <div className="p-3 bg-secondary rounded-md mb-4">
                                <p className="font-semibold">{selectedNode.text}</p>
                            </div>
                            
                            <div className="mb-4">
                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Actions</h4>
                                <button onClick={handleAddNode} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors">
                                    <Plus size={16} /> Add Child Node
                                </button>
                            </div>

                            <div className="mb-4">
                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Node Color</h4>
                                <div className="flex flex-wrap gap-2">
                                    {['#60A5FA', '#FBBF24', '#4ADE80', '#F87171', '#A78BFA', '#4B5563', '#EC4899'].map(color => (
                                        <button key={color} onClick={() => handleColorChange(color)}
                                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${selectedNode.color === color ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''}`}
                                            style={{ backgroundColor: color }} aria-label={`Change color to ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto text-sm text-foreground/90 border-t border-border pt-4 mt-2">
                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">AI Explanation</h4>
                                {isExplaining ? <div className="flex items-center gap-2"><Spinner/> Generating...</div> : <p className="whitespace-pre-wrap leading-relaxed">{explanation}</p>}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default InteractiveMindMap;
