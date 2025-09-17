import { supabase, Database } from './supabase-config';
import { PortalUser } from '../types';

// FIX: Changed type definitions to be derived from the Database interface.
// This is a more stable way to define types and avoids complex inference that was causing errors.
export type Session = Database['public']['Tables']['portal_sessions']['Row'];
export type AttendanceRecord = Database['public']['Tables']['portal_attendance']['Row'];

// --- AUTH & USER PROFILE ---

export const signUpUser = async (userData: any) => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
            data: {
                name: userData.name,
                role: userData.role,
                enrollment_id: userData.enrollment_id,
                ug_number: userData.ug_number,
                phone_number: userData.phone_number
            }
        }
    });
    if (error) throw error;
    return data;
};

export const signInUser = async (email: string, password: string): Promise<PortalUser> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Login failed, user not found.");

    const profile = await getUserProfile(authData.user.id);
    return profile;
};

export const getUserProfile = async (userId: string): Promise<PortalUser> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data, error } = await supabase.from('portal_users').select('*').eq('id', userId).single();
    if (error) throw error;
    if (!data) throw new Error("User profile not found.");
    return data as PortalUser;
};

export const getPendingStudents = async (): Promise<PortalUser[]> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data, error } = await supabase.from('portal_users').select('*').eq('role', 'student').eq('approved', false);
    if (error) throw error;
    return (data as PortalUser[]) || [];
};

export const approveStudent = async (studentId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    const { error } = await supabase.from('portal_users').update({ approved: true }).eq('id', studentId);
    if (error) throw error;
};

// --- SESSION MANAGEMENT ---

export const startSession = async (sessionData: { teacherId: string, locationEnforced: boolean, radius: number, location: any }): Promise<Session> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const session_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data, error } = await supabase.from('portal_sessions').insert({
        teacher_id: sessionData.teacherId,
        session_code,
        expires_at,
        location_enforced: sessionData.locationEnforced,
        radius: sessionData.radius,
        location: sessionData.location,
    }).select().single();

    if (error) throw error;
    return data;
};

export const getActiveSession = async (): Promise<Session | null> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('portal_sessions')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) throw error;
    return data?.[0] || null;
};

export const endActiveSession = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const session = await getActiveSession();
    if (session) {
        const { error } = await supabase.from('portal_sessions').update({ is_active: false }).eq('id', session.id);
        if (error) throw error;
    }
};

// --- ATTENDANCE ---

export const logAttendance = async (record: any): Promise<void> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { error } = await supabase.from('portal_attendance').insert(record);
    if (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new Error("You have already checked in for this session.");
        }
        throw error;
    }
};

export const getAttendanceForSession = async (sessionId: string): Promise<AttendanceRecord[]> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.from('portal_attendance')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};


// --- CURRICULUM FILES ---

export const uploadCurriculumFile = async (teacherId: string, teacherName: string, file: File): Promise<void> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    const storagePath = `${teacherId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('curriculum_uploads').upload(storagePath, file);
    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from('curriculum_files').insert({
        teacher_id: teacherId,
        teacher_name: teacherName,
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath
    });

    if (dbError) {
        // Attempt to clean up storage if DB insert fails
        await supabase.storage.from('curriculum_uploads').remove([storagePath]);
        throw dbError;
    }
};

export const getCurriculumFiles = async (): Promise<any[]> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.from('curriculum_files').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const deleteCurriculumFile = async (fileId: string, storagePath: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { error: storageError } = await supabase.storage.from('curriculum_uploads').remove([storagePath]);
    if (storageError) throw storageError;

    const { error: dbError } = await supabase.from('curriculum_files').delete().eq('id', fileId);
    if (dbError) throw dbError;
};
