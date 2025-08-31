import React, { useState, useEffect, useCallback } from 'react';
import { DriveFile, WorkspaceHistoryEntry } from '../App';
import { FileText, Table, History, Search, Download, Briefcase, Info } from 'lucide-react';

declare const google: any;

interface GoogleWorkspaceProps {
    authToken: any | null;
    setAuthToken: (token: any | null) => void;
    history: WorkspaceHistoryEntry[];
    onFileImport: (data: { file: DriveFile; htmlContent: string }) => void;
}

const CLIENT_ID = '93015436329-3736s0ce29ab34d6652re8u8v8h79v3r.apps.googleusercontent.com'; // Replace with your actual client ID if you have one, this is a placeholder
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

const GoogleWorkspace: React.FC<GoogleWorkspaceProps> = ({ authToken, setAuthToken, history, onFileImport }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importingId, setImportingId] = useState<string | null>(null);

    const handleAuthClick = () => {
        const codeClient = google.accounts.oauth2.initCodeClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            ux_mode: 'popup',
            callback: async (response: any) => {
                if (response.error) {
                    setError(`Authentication error: ${response.error_description || 'Unknown error'}`);
                    return;
                }
                
                try {
                    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            code: response.code,
                            client_id: CLIENT_ID,
                            redirect_uri: 'postmessage', // Required for popup flow token exchange
                            grant_type: 'authorization_code'
                        })
                    });

                    const tokenData = await tokenResponse.json();

                    if (tokenData.error) {
                        setError(`Token exchange error: ${tokenData.error_description}`);
                        return;
                    }
                    
                    setAuthToken(tokenData);

                } catch (err: any) {
                    setError(`Token exchange failed: ${err.message}`);
                }
            },
            error_callback: (err: any) => {
                setError(`Auth flow error: ${err.message || 'An error occurred during sign-in.'}`);
            }
        });
        codeClient.requestCode();
    };

    const handleSignOut = () => {
        if(authToken) {
            google.accounts.oauth2.revoke(authToken.access_token, () => {});
            setAuthToken(null);
            setFiles([]);
        }
    }
    
    const searchFiles = useCallback(async () => {
        if (!authToken) return;
        setIsLoading(true);
        setError(null);
        try {
            const query = `(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet') and name contains '${searchQuery}' and trashed = false`;
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,iconLink)`, {
                headers: { 'Authorization': `Bearer ${authToken.access_token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    handleSignOut();
                    throw new Error("Session expired. Please sign in again.");
                }
                throw new Error(`Failed to fetch files: ${response.statusText}`);
            }
            const data = await response.json();
            setFiles(data.files || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [authToken, searchQuery]);

    useEffect(() => {
        if (authToken) {
            searchFiles();
        }
    }, [authToken, searchFiles]);

    const handleImportClick = async (file: DriveFile) => {
        if (!authToken) return;
        setImportingId(file.id);
        setError(null);
        try {
            const isDoc = file.mimeType === 'application/vnd.google-apps.document';
            const exportMimeType = isDoc ? 'text/html' : 'text/html';
            
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${exportMimeType}`, {
                headers: { 'Authorization': `Bearer ${authToken.access_token}` }
            });

             if (!response.ok) {
                if (response.status === 401) {
                    handleSignOut();
                    throw new Error("Session expired. Please sign in again.");
                }
                throw new Error(`Failed to import file content: ${response.statusText}`);
            }
            const htmlContent = await response.text();
            onFileImport({ file, htmlContent });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setImportingId(null);
        }
    };
    
    if (!authToken) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
                <div className="p-8 border border-border rounded-lg bg-card/50">
                    <Briefcase className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Connect to Google Workspace</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Sign in with your Google account to securely search your Drive and import content from Docs and Sheets directly into your notes.
                    </p>
                    <button
                        onClick={handleAuthClick}
                        className="flex items-center justify-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 48 48" fill="currentColor"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A953" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                        Sign in with Google
                    </button>
                    {error && <p className="text-destructive text-sm mt-4">{error}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <header className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Briefcase className="w-6 h-6 text-primary"/>
                    <h1 className="text-xl font-bold">Google Workspace</h1>
                </div>
                <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign Out</button>
            </header>
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                {/* Main Content */}
                <main className="flex-1 flex flex-col p-6 overflow-y-auto">
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchFiles()}
                            placeholder="Search your Google Docs & Sheets..."
                            className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                         <div className="flex-1 flex items-center justify-center text-center">
                            <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                                <Info className="w-8 h-8 mx-auto mb-2"/>
                                <p className="font-semibold">An Error Occurred</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                            <p>No files found. Try another search.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {files.map(file => (
                                <div key={file.id} className="bg-card/80 border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {file.mimeType.includes('spreadsheet') ? <Table className="w-5 h-5 text-green-500 flex-shrink-0"/> : <FileText className="w-5 h-5 text-blue-500 flex-shrink-0"/>}
                                        <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleImportClick(file)}
                                        disabled={importingId === file.id}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {importingId === file.id ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4"/>
                                                Import
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                {/* History Sidebar */}
                <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border flex-shrink-0 flex flex-col">
                     <div className="p-4 border-b border-border flex items-center gap-3">
                         <History className="w-5 h-5 text-muted-foreground"/>
                         <h2 className="font-semibold">Import History</h2>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center pt-8">Your imported files will appear here.</p>
                        ) : (
                           history.map(entry => (
                               <div key={entry.fileId + entry.importedAt} className="bg-secondary/50 p-3 rounded-md">
                                   <div className="flex items-start gap-2">
                                       {entry.fileType === 'sheet' ? <Table className="w-4 h-4 text-green-500 mt-1 flex-shrink-0"/> : <FileText className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0"/>}
                                        <div>
                                            <p className="text-sm font-semibold truncate" title={entry.fileName}>{entry.fileName}</p>
                                            <p className="text-xs text-muted-foreground truncate" title={`Imported into: ${entry.noteTitle}`}>
                                                to: {entry.noteTitle}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(entry.importedAt).toLocaleString()}
                                            </p>
                                        </div>
                                   </div>
                               </div>
                           ))
                        )}
                     </div>
                </aside>
            </div>
        </div>
    );
};

export default GoogleWorkspace;