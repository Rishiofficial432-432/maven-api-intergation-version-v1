import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Tool, Part, Type, Chat } from '@google/genai';
import { geminiAI } from './gemini';
import { MessageCircleIcon, SendHorizonalIcon, MicIcon, MicOffIcon } from './Icons';
import { Spinner } from './Spinner';
import Clock from './Clock';
import { Page } from '../App';
import { ChevronRight, Sun } from 'lucide-react';

interface Message {
    role: 'user' | 'model';
    parts: Part[];
}

interface ChatbotProps {
    onAddTask: (text: string) => string;
    onAddEvent: (title: string, date: string, time: string) => string;
    onNewPage: (title: string, content?: string) => Page;
    onGetDailyBriefing: () => string;
    onGenerateCreativeContent: (content: string) => string;
    onCompleteTaskByText: (text: string) => string;
    onDeleteTaskByText: (text: string) => string;
    onListTasks: () => string;
    onDeleteNoteByTitle: (title: string) => Promise<string>;
    onMoveKanbanCard: (cardText: string, targetColumn: string) => string;
    onAddQuickNote: (text: string) => string;
    onListQuickNotes: () => string;
    onAddHabit: (name: string) => string;
    onCompleteHabit: (name: string) => string;
    onDeleteHabit: (name: string) => string;
    onListHabits: () => string;
    onStartPomodoro: () => string;
    onPausePomodoro: () => string;
    onResetPomodoro: () => string;
    onAddDecisionOption: (option: string) => string;
    onAddDecisionOptions: (options: string[]) => string;
    onClearDecisionOptions: () => string;
    onMakeDecision: (options?: string[]) => Promise<string>;
    onPlanAndCreateNote: (topic: string) => Promise<string>;
    onWireframeAndCreateNote: (description: string) => Promise<string>;
    onAddJournalEntry: (content: string, date?: string) => string;
    onAddGoal: (text: string) => string;
    onLogMood: (mood: string) => string;
    onAddExpense: (description: string, amount: number, category: string) => string;
    onAddPersonalQuote: (text: string) => string;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

// Type definitions for Web Speech API to fix TypeScript errors
interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    start(): void;
    stop(): void;
}

interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
}

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

const tools: Tool[] = [{
    functionDeclarations: [
        {
            name: "addGoal",
            description: "Adds a new personal goal to the user's goal list.",
            parameters: { type: Type.OBJECT, properties: { goalText: { type: Type.STRING, description: "The content of the goal." } }, required: ["goalText"] }
        },
        {
            name: "logMood",
            description: "Logs the user's mood for the current day. Replaces any existing entry for today.",
            parameters: { type: Type.OBJECT, properties: { mood: { type: Type.STRING, description: "The user's mood. Can be an emoji or a word like 'Happy', 'Sad', etc. E.g., '😄', '😊', '😐', '😢', '😴'" } }, required: ["mood"] }
        },
        {
            name: "addExpense",
            description: "Adds a new expense to the expense tracker.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "What the expense was for." },
                    amount: { type: Type.NUMBER, description: "The amount of the expense." },
                    category: { type: Type.STRING, description: "An optional category for the expense (e.g., Food, Transport)." }
                },
                required: ["description", "amount"]
            }
        },
        {
            name: "addPersonalQuote",
            description: "Adds a new quote to the user's personal collection.",
            parameters: { type: Type.OBJECT, properties: { quoteText: { type: Type.STRING, description: "The content of the quote." } }, required: ["quoteText"] }
        },
        {
            name: "addJournalEntry",
            description: "Adds a new journal entry for a specific date. If no date is provided, it uses today's date.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    content: {
                        type: Type.STRING,
                        description: "The text content of the journal entry."
                    },
                    date: {
                        type: Type.STRING,
                        description: "Optional. The date for the entry in YYYY-MM-DD format. Defaults to today if not provided."
                    }
                },
                required: ["content"]
            }
        },
        {
            name: "createPlanAndNote",
            description: "Creates a detailed, structured plan for a given topic, project, or goal and saves it as a new note.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    topic: {
                        type: Type.STRING,
                        description: "The subject or goal for which to create a plan. For example, 'launch a new podcast' or 'learn to cook'."
                    }
                },
                required: ["topic"]
            }
        },
        {
            name: "createWireframeAndNote",
            description: "Suggests a structural layout or wireframe for a user interface, webpage, or app screen based on a description, then saves it as a new note.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    description: {
                        type: Type.STRING,
                        description: "A description of the screen or interface to be wireframed. For example, 'a login screen for a mobile app' or 'a product details page for an e-commerce site'."
                    }
                },
                required: ["description"]
            }
        },
        {
            name: "addTask",
            description: "Adds a new task to the user's to-do list.",
            parameters: { type: Type.OBJECT, properties: { taskText: { type: Type.STRING, description: "The content of the task." } }, required: ["taskText"] }
        },
        {
            name: "completeTask",
            description: "Marks a task as completed based on its text content.",
            parameters: { type: Type.OBJECT, properties: { taskText: { type: Type.STRING, description: "The text of the task to complete." } }, required: ["taskText"] }
        },
        {
            name: "deleteTask",
            description: "Deletes a task based on its text content.",
            parameters: { type: Type.OBJECT, properties: { taskText: { type: Type.STRING, description: "The text of the task to delete." } }, required: ["taskText"] }
        },
        {
            name: "listTasks",
            description: "Lists all current tasks, separated by completion status.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "addEvent",
            description: "Schedules a new event in the calendar.",
            parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING, description: "YYYY-MM-DD" }, time: { type: Type.STRING, description: "HH:MM" } }, required: ["title", "date", "time"] }
        },
        {
            name: "createNewNote",
            description: "Creates a new, blank note page.",
            parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ["title"] }
        },
        {
            name: "deleteNote",
            description: "Deletes a note based on its title.",
            parameters: { type: Type.OBJECT, properties: { noteTitle: { type: Type.STRING } }, required: ["noteTitle"] }
        },
        {
            name: "generateCreativeContent",
            description: "Generates creative content and appends it to the currently active note.",
            parameters: { type: Type.OBJECT, properties: { content: { type: Type.STRING } }, required: ["content"] }
        },
         {
            name: "getDailyBriefing",
            description: "Provides a summary of the user's tasks and calendar events for the day.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "moveKanbanCard",
            description: "Moves a card on the Kanban board to a different column.",
            parameters: { type: Type.OBJECT, properties: { cardText: { type: Type.STRING }, targetColumn: { type: Type.STRING, description: "The destination column: 'To Do', 'In Progress', or 'Done'." } }, required: ["cardText", "targetColumn"] }
        },
        {
            name: "addQuickNote",
            description: "Adds a new temporary note to the quick notes list.",
            parameters: { type: Type.OBJECT, properties: { noteText: { type: Type.STRING, description: "The content of the quick note." } }, required: ["noteText"] }
        },
        {
            name: "listQuickNotes",
            description: "Lists all current quick notes.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "addHabit",
            description: "Adds a new habit to the habit tracker.",
            parameters: { type: Type.OBJECT, properties: { habitName: { type: Type.STRING, description: "The name of the habit to track." } }, required: ["habitName"] }
        },
        {
            name: "completeHabit",
            description: "Marks a habit as completed for today.",
            parameters: { type: Type.OBJECT, properties: { habitName: { type: Type.STRING, description: "The name of the habit to complete." } }, required: ["habitName"] }
        },
        {
            name: "deleteHabit",
            description: "Deletes a habit from the habit tracker.",
            parameters: { type: Type.OBJECT, properties: { habitName: { type: Type.STRING, description: "The name of the habit to delete." } }, required: ["habitName"] }
        },
        {
            name: "listHabits",
            description: "Lists all tracked habits and their current streaks.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "startPomodoro",
            description: "Starts the Pomodoro timer for a 25-minute session.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "pausePomodoro",
            description: "Pauses the currently running Pomodoro timer.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "resetPomodoro",
            description: "Resets the Pomodoro timer to 25 minutes and stops it.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "addDecisionOption",
            description: "Adds a single option to the Random Decision Maker tool.",
            parameters: { type: Type.OBJECT, properties: { option: { type: Type.STRING, description: "The option to add." } }, required: ["option"] }
        },
        {
            name: "addDecisionOptions",
            description: "Adds multiple options to the Random Decision Maker tool.",
            parameters: { type: Type.OBJECT, properties: { options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of options to add." } }, required: ["options"] }
        },
        {
            name: "clearDecisionOptions",
            description: "Removes all options from the Random Decision Maker.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "makeDecision",
            description: "Makes a random decision from the existing list of options. If new options are provided, it will use them instead.",
            parameters: { type: Type.OBJECT, properties: { options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An optional array of options to decide between." } } }
        }
    ]
}];

const Chatbot: React.FC<ChatbotProps> = (props) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const { isCollapsed, setIsCollapsed } = props;

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported by this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map(result => result[0])
              .map(result => result.transcript)
              .join('');
            setInput(transcript);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    const handleToggleListening = () => {
        if (!recognitionRef.current) return;
        
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };
    
    const chat = useMemo(() => {
        if (!geminiAI) return null;
        return geminiAI.chats.create({
          model: "gemini-2.5-flash",
          history: messages.map(msg => ({
              role: msg.role,
              parts: msg.parts.map(part => ({ text: part.text as string }))
          })),
          config: {
            systemInstruction: "You are a helpful and versatile AI assistant for the Maven application. Your primary role is to help users manage their tasks, notes, events, and other productivity features by using the available tools. You can also engage in general conversation on any topic the user wishes to discuss. Be friendly, conversational, and efficient.",
            tools
          }
        });
    }, [messages]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent | string) => {
        if (typeof e !== 'string') {
            e.preventDefault();
        }

        const currentInput = (typeof e === 'string' ? e : input).trim();
        if (!currentInput || isLoading || !chat) return;

        // Stop listening if active
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        const userMessage: Message = { role: 'user', parts: [{ text: currentInput }] };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chat.sendMessage({ message: currentInput });
            const functionCalls = result.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                let functionResponse;

                // Execute the function
                switch(call.name) {
                    case 'addGoal': functionResponse = props.onAddGoal(call.args.goalText as string); break;
                    case 'logMood': functionResponse = props.onLogMood(call.args.mood as string); break;
                    case 'addExpense': functionResponse = props.onAddExpense(call.args.description as string, call.args.amount as number, call.args.category as string); break;
                    case 'addPersonalQuote': functionResponse = props.onAddPersonalQuote(call.args.quoteText as string); break;
                    case 'addJournalEntry': functionResponse = props.onAddJournalEntry(call.args.content as string, call.args.date as string | undefined); break;
                    case 'createPlanAndNote': functionResponse = await props.onPlanAndCreateNote(call.args.topic as string); break;
                    case 'createWireframeAndNote': functionResponse = await props.onWireframeAndCreateNote(call.args.description as string); break;
                    case 'addTask': functionResponse = props.onAddTask(call.args.taskText as string); break;
                    case 'addEvent': functionResponse = props.onAddEvent(call.args.title as string, call.args.date as string, call.args.time as string); break;
                    case 'createNewNote': functionResponse = `📝 Note created: "${(props.onNewPage(call.args.title as string)).title}"`; break;
                    case 'generateCreativeContent': functionResponse = props.onGenerateCreativeContent(call.args.content as string); break;
                    case 'getDailyBriefing': functionResponse = props.onGetDailyBriefing(); break;
                    case 'completeTask': functionResponse = props.onCompleteTaskByText(call.args.taskText as string); break;
                    case 'deleteTask': functionResponse = props.onDeleteTaskByText(call.args.taskText as string); break;
                    case 'listTasks': functionResponse = props.onListTasks(); break;
                    case 'deleteNote': functionResponse = await props.onDeleteNoteByTitle(call.args.noteTitle as string); break;
                    case 'moveKanbanCard': functionResponse = props.onMoveKanbanCard(call.args.cardText as string, call.args.targetColumn as string); break;
                    case 'addQuickNote': functionResponse = props.onAddQuickNote(call.args.noteText as string); break;
                    case 'listQuickNotes': functionResponse = props.onListQuickNotes(); break;
                    case 'addHabit': functionResponse = props.onAddHabit(call.args.habitName as string); break;
                    case 'completeHabit': functionResponse = props.onCompleteHabit(call.args.habitName as string); break;
                    case 'deleteHabit': functionResponse = props.onDeleteHabit(call.args.habitName as string); break;
                    case 'listHabits': functionResponse = props.onListHabits(); break;
                    case 'startPomodoro': functionResponse = props.onStartPomodoro(); break;
                    case 'pausePomodoro': functionResponse = props.onPausePomodoro(); break;
                    case 'resetPomodoro': functionResponse = props.onResetPomodoro(); break;
                    case 'addDecisionOption': functionResponse = props.onAddDecisionOption(call.args.option as string); break;
                    case 'addDecisionOptions': functionResponse = props.onAddDecisionOptions(call.args.options as string[]); break;
                    case 'clearDecisionOptions': functionResponse = props.onClearDecisionOptions(); break;
                    case 'makeDecision': functionResponse = await props.onMakeDecision(call.args.options as string[] | undefined); break;
                    default: functionResponse = `Sorry, I can't do that.`;
                }
                
                // Send the result back to the model
                 const secondResult = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: { content: functionResponse } } }] });

                // Display the model's natural language response
                 const modelMessage: Message = { role: 'model', parts: [{ text: secondResult.text }] };
                 setMessages(prev => [...prev, modelMessage]);

            } else { // It's a regular text response
                 const modelMessage: Message = { role: 'model', parts: [{ text: result.text }] };
                 setMessages(prev => [...prev, modelMessage]);
            }
        } catch (err) {
            console.error("Chatbot API error:", err);
            const errorMessage = "Sorry, I'm having trouble connecting. Please try again later.";
            setMessages(prev => [...prev, { role: 'model', parts: [{text: errorMessage}] }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isCollapsed) {
        return (
            <div className="flex flex-col h-full bg-background/50 items-center pt-6">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                    title="Expand AI Assistant"
                >
                    <MessageCircleIcon className="w-5 h-5" />
                </button>
            </div>
        );
    }
    
    if (!geminiAI) {
        return (
             <div className="flex flex-col h-full bg-background/50 border-t border-border/50">
                <div className="p-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                     <div className="flex items-center gap-2">
                        <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
                    </div>
                     <button onClick={() => setIsCollapsed(true)} className="p-1 rounded-md hover:bg-accent text-muted-foreground" title="Collapse AI Assistant">
                        <ChevronRight size={20}/>
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center p-4 text-center text-muted-foreground">
                    <p>AI Assistant is offline. Please configure your API key to enable this feature.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background/50 border-t border-border/50">
            <div className="p-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Clock />
                    <button 
                        onClick={() => setIsCollapsed(true)} 
                        className="p-1 rounded-md hover:bg-accent text-muted-foreground"
                        title="Collapse AI Assistant"
                    >
                       <ChevronRight size={20}/>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {messages.length === 0 && (
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0"></div>
                        <div className="p-3 rounded-xl max-w-xs md:max-w-sm break-words bg-accent text-accent-foreground/90 rounded-bl-none">
                            <p className="text-sm leading-6">Hello! I'm your AI assistant. How can I help you manage your day?</p>
                            <button 
                                onClick={() => handleSendMessage("Give me my daily briefing")}
                                className="mt-2 flex items-center gap-2 text-sm bg-background/50 hover:bg-background/80 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Sun size={14} />
                                Get my daily briefing
                            </button>
                        </div>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0"></div>}
                        <div className={`p-3 rounded-xl max-w-xs md:max-w-sm break-words ${
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-accent text-accent-foreground/90 rounded-bl-none'
                        }`}>
                            <p className="text-sm leading-6 whitespace-pre-wrap">{msg.parts[0]?.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0"></div>
                        <div className="p-3 rounded-xl rounded-bl-none bg-accent">
                            <Spinner />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-border/50 flex-shrink-0">
                <form ref={formRef} onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Ask your assistant..."}
                        className="w-full bg-input border border-transparent focus:border-primary focus:ring-0 text-sm rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none transition"
                        disabled={isLoading}
                    />
                    <button 
                        type="button" 
                        onClick={handleToggleListening}
                        disabled={!recognitionRef.current || isLoading}
                        className={`p-2.5 rounded-md transition-colors disabled:opacity-50 ${isListening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary text-secondary-foreground/90 hover:bg-secondary/80'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                    </button>
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-2.5 bg-primary text-primary-foreground rounded-md disabled:bg-secondary disabled:text-muted-foreground hover:bg-primary/90 transition-colors">
                        <SendHorizonalIcon className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chatbot;