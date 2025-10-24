
import { create } from 'zustand';
import { User, Role, Ticket, ErrorType, AutomatedMessage, AuditLog, TicketStatus, SystemNotification, AdminNotification, Feedback, Team } from './types';
import { mockUsers, mockTickets, mockErrorTypes, mockMessages, mockLogs, mockNotifications, mockAdminNotifications, mockFeedback } from './mockData';

// Helper to simulate API delay
const apiDelay = <T,>(data: T): Promise<T> => new Promise(res => setTimeout(() => res(data), 300));

// --- Session Store ---
interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  team: string | null;
  login: (email: string) => boolean;
  logout: () => void;
  setTeam: (team: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isAuthenticated: false,
  team: null,
  login: (email) => {
    const foundUser = mockUsers.find(u => u.email === email);
    if (foundUser) {
      set({ user: foundUser, isAuthenticated: true, team: foundUser.team || null });
      return true;
    }
    return false;
  },
  logout: () => {
    set({ user: null, isAuthenticated: false, team: null });
  },
  setTeam: (team) => {
    set({ team });
  }
}));

// --- Ticket Store ---
interface KPI {
  activeTickets: number;
  closedTickets: number;
  avgTimeToSolve: string;
}
interface TicketState {
  tickets: Ticket[];
  notifications: SystemNotification[];
  adminNotifications: AdminNotification[];
  kpis: KPI;
  fetchTickets: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchAdminNotifications: () => Promise<void>;
  addTicket: (ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'preId' | 'status' | 'team'>) => Promise<void>;
  updateTicket: (ticketData: Partial<Ticket> & { id: string }) => Promise<void>;
  markAdminNotificationAsRead: (notificationId: string) => Promise<void>;
  markSystemNotificationAsRead: (notificationId: string) => Promise<void>;
  addFeedback: (data: { feedback: string }) => Promise<void>;
  calculateKPIs: (tickets: Ticket[]) => void;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  notifications: [],
  adminNotifications: [],
  kpis: { activeTickets: 0, closedTickets: 0, avgTimeToSolve: 'N/A' },
  fetchTickets: async () => {
    const data = await apiDelay(mockTickets);
    set({ tickets: data });
  },
  fetchNotifications: async () => {
    const data = await apiDelay(mockNotifications);
    set({ notifications: [...data] });
  },
  fetchAdminNotifications: async () => {
    const data = await apiDelay(mockAdminNotifications);
    set({ adminNotifications: data });
  },
  addTicket: async (ticketData) => {
    const session = useSessionStore.getState();
    const user = session.user;

    if (!user) {
        throw new Error("Ticket creation failed: Your session has expired. Please log out and log back in.");
    }
    
    const preId = user.id;
    // For PREs, the team is selected and stored in the session state.
    // For other roles like ASM/BDM, the team is a fixed part of their user profile.
    const team = user.role === Role.PRE ? session.team as Team : user.team;

    if (!preId || !team) {
        throw new Error("Ticket creation failed: Your team information is missing. Please log out and log back in.");
    }

    let status = TicketStatus.IN_PROGRESS;
    const automatedMessageToSend = mockMessages.find(m => m.errorTypeId === ticketData.errorTypeId);

    if (automatedMessageToSend) {
        // This error type has an automated resolution. Check if it's a re-submission.
        const existingTicket = get().tickets.find(
            t => t.uid === ticketData.uid && t.errorTypeId === ticketData.errorTypeId
        );
        
        if (existingTicket) {
            // It's a re-submission, so escalate.
            status = TicketStatus.ESCALATED;
        } else {
            // First time, auto-close and notify PRE.
            status = TicketStatus.CLOSED;
        }
    }

    const newTicket: Ticket = {
      ...ticketData,
      id: `ticket-${Date.now()}`,
      preId,
      team,
      status: status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockTickets.unshift(newTicket);

    const newAdminNotification: AdminNotification = {
        id: `admin-notif-${Date.now()}`,
        ticketId: newTicket.id,
        message: `New ticket from UID ${newTicket.uid} was created.`,
        timestamp: new Date().toISOString(),
        isRead: false,
    };
    
    if (status === TicketStatus.ESCALATED) {
         newAdminNotification.message = `Ticket for UID ${newTicket.uid} was re-submitted and has been escalated.`;
         const newNotification: SystemNotification = {
            id: `notif-${Date.now()}`,
            ticketId: newTicket.id,
            preId,
            uid: newTicket.uid,
            message: `Your ticket submission for UID ${newTicket.uid} (Ticket #${newTicket.id.split('-')[1]}) was escalated.`,
            timestamp: new Date().toISOString(),
            isRead: false,
        };
        mockNotifications.unshift(newNotification);
    }

    mockAdminNotifications.unshift(newAdminNotification);

    if (status === TicketStatus.CLOSED && automatedMessageToSend) {
        const newNotification: SystemNotification = {
            id: `notif-${Date.now()}`,
            ticketId: newTicket.id,
            preId,
            uid: newTicket.uid,
            message: `Ticket #${newTicket.id.split('-')[1]} for UID ${newTicket.uid}: ${automatedMessageToSend.message}`,
            timestamp: new Date().toISOString(),
            isRead: false,
        };
        mockNotifications.unshift(newNotification);
    }

    set({ tickets: [...mockTickets], notifications: [...mockNotifications], adminNotifications: [...mockAdminNotifications] });

    await apiDelay(newTicket);
    useAdminStore.getState().addLog({
        ticketId: newTicket.id,
        userId: preId,
        action: 'CREATE',
        details: `Ticket created for UID ${newTicket.uid} with status ${status}.`
    });
  },
  updateTicket: async (ticketData) => {
    const adminId = useSessionStore.getState().user?.id;
    if (!adminId) return;

    const updatedTicketData = {
        ...ticketData,
        updatedAt: new Date().toISOString(),
    };
    
    let originalStatus: TicketStatus | undefined;
    const ticketIndex = mockTickets.findIndex(t => t.id === ticketData.id);

    if (ticketIndex > -1) {
        originalStatus = mockTickets[ticketIndex].status;
        const originalTicket = mockTickets[ticketIndex];
        mockTickets[ticketIndex] = { ...mockTickets[ticketIndex], ...updatedTicketData };
        const updatedTicket = mockTickets[ticketIndex];
        
        if (ticketData.status === TicketStatus.ESCALATED && originalStatus !== TicketStatus.ESCALATED) {
            const newAdminNotification: AdminNotification = {
                id: `admin-notif-${Date.now()}`,
                ticketId: ticketData.id,
                message: `Ticket for UID ${originalTicket.uid} has been escalated.`,
                timestamp: new Date().toISOString(),
                isRead: false,
            };
            mockAdminNotifications.unshift(newAdminNotification);

            const newNotification: SystemNotification = {
                id: `notif-escalated-${Date.now()}`,
                ticketId: updatedTicket.id,
                preId: updatedTicket.preId,
                uid: updatedTicket.uid,
                message: `Your ticket #${updatedTicket.id.split('-')[1]} for UID ${updatedTicket.uid} has been manually escalated.`,
                timestamp: new Date().toISOString(),
                isRead: false,
            };
            mockNotifications.unshift(newNotification);
        }

        if (
            (updatedTicket.status === TicketStatus.COMPLETED || updatedTicket.status === TicketStatus.CLOSED) &&
            originalStatus !== updatedTicket.status
        ) {
            const newNotification: SystemNotification = {
                id: `notif-${Date.now()}`,
                ticketId: updatedTicket.id,
                preId: updatedTicket.preId,
                uid: updatedTicket.uid,
                message: `Your ticket #${updatedTicket.id.split('-')[1]} for UID ${updatedTicket.uid} has been resolved. DataCR Comment: "${updatedTicket.comment || 'No comment provided.'}"`,
                timestamp: new Date().toISOString(),
                isRead: false,
            };
            mockNotifications.unshift(newNotification);
        }
    }

    set({ tickets: [...mockTickets], notifications: [...mockNotifications], adminNotifications: [...mockAdminNotifications] });

    await apiDelay(updatedTicketData);
    
    let details = `Ticket details updated for ${ticketData.id}.`;
    if (ticketData.status && ticketData.status !== originalStatus) {
        details = `Status changed to ${ticketData.status} for ticket ${ticketData.id}.`;
    }
    
    useAdminStore.getState().addLog({
        ticketId: ticketData.id,
        userId: adminId,
        action: 'UPDATE',
        details,
    });
  },
   markAdminNotificationAsRead: async (notificationId) => {
    const notifIndex = mockAdminNotifications.findIndex(n => n.id === notificationId);
    if (notifIndex > -1) {
        mockAdminNotifications[notifIndex].isRead = true;
    }
    set({ adminNotifications: [...mockAdminNotifications] });
    await apiDelay(notificationId);
  },
  markSystemNotificationAsRead: async (notificationId) => {
    const notifIndex = mockNotifications.findIndex(n => n.id === notificationId);
    if (notifIndex > -1) {
        mockNotifications[notifIndex].isRead = true;
    }
    set({ notifications: [...mockNotifications] });
    await apiDelay(notificationId);
  },
  addFeedback: async ({ feedback }) => {
    const preId = useSessionStore.getState().user?.id;
    if (!preId) return;

    const newFeedback: Feedback = {
        id: `feedback-${Date.now()}`,
        preId,
        feedback,
        timestamp: new Date().toISOString(),
    };
    mockFeedback.unshift(newFeedback);
    await apiDelay(newFeedback);
  },
  calculateKPIs: (filteredTickets) => {
    const activeTickets = filteredTickets.filter(
        t => t.status === TicketStatus.IN_PROGRESS || t.status === TicketStatus.ESCALATED
    ).length;

    const closedOrCompletedTickets = filteredTickets.filter(
        t => t.status === TicketStatus.COMPLETED || t.status === TicketStatus.CLOSED
    );
    
    const closedTickets = closedOrCompletedTickets.length;

    let avgTimeToSolve = 'N/A';
    if (closedTickets > 0) {
        const totalSolveTime = closedOrCompletedTickets.reduce((acc, t) => {
            const created = new Date(t.createdAt).getTime();
            const updated = new Date(t.updatedAt).getTime();
            return acc + (updated - created);
        }, 0);

        const avgMilliseconds = totalSolveTime / closedTickets;
        const avgDays = avgMilliseconds / (1000 * 60 * 60 * 24);
        avgTimeToSolve = `${avgDays.toFixed(1)} days`;
    }
    
    set({ kpis: { activeTickets, closedTickets, avgTimeToSolve } });
  },
}));

// --- Admin Store ---
interface AdminState {
  users: User[];
  errorTypes: ErrorType[];
  messages: AutomatedMessage[];
  logs: AuditLog[];
  feedbacks: Feedback[];
  fetchAdminData: () => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  addBulkUsers: (users: Omit<User, 'id'>[]) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addLog: (logData: Omit<AuditLog, 'id' | 'timestamp'>) => Promise<void>;
  addErrorType: (errorType: Omit<ErrorType, 'id'>) => Promise<void>;
  addBulkErrorTypes: (errorTypes: Omit<ErrorType, 'id'>[]) => Promise<void>;
  updateErrorType: (errorType: ErrorType) => Promise<void>;
  deleteErrorType: (errorTypeId: string) => Promise<void>;
  addMessage: (message: Omit<AutomatedMessage, 'id'>) => Promise<void>;
  addBulkMessages: (messages: Omit<AutomatedMessage, 'id'>[]) => Promise<void>;
  updateMessage: (message: AutomatedMessage) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  errorTypes: [],
  messages: [],
  logs: [],
  feedbacks: [],
  fetchAdminData: async () => {
    const [users, errorTypes, messages, logs, feedbacks] = await Promise.all([
      apiDelay(mockUsers),
      apiDelay(mockErrorTypes),
      apiDelay(mockMessages),
      apiDelay(mockLogs),
      apiDelay(mockFeedback)
    ]);
    set({ users, errorTypes, messages, logs, feedbacks });
  },
  addUser: async (userData) => {
    const newUser = { ...userData, id: `user-${Date.now()}` } as User;
    mockUsers.push(newUser);
    set({ users: [...mockUsers] });
    await apiDelay(newUser);
  },
  addBulkUsers: async (usersData) => {
    const newUsers: User[] = usersData.map(userData => ({
      ...userData,
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));
    mockUsers.push(...newUsers);
    set({ users: [...mockUsers] });
    await apiDelay(newUsers);
  },
  updateUser: async (updatedUser) => {
    const userIndex = mockUsers.findIndex(u => u.id === updatedUser.id);
    if(userIndex > -1) mockUsers[userIndex] = updatedUser;
    set(state => ({ users: state.users.map(u => u.id === updatedUser.id ? updatedUser : u) }));
    await apiDelay(updatedUser);
  },
  deleteUser: async (userId) => {
    const userIndex = mockUsers.findIndex(u => u.id === userId);
    if (userIndex > -1) {
        mockUsers.splice(userIndex, 1);
    }
    set(state => ({ users: state.users.filter(u => u.id !== userId) }));
    await apiDelay(userId);
  },
  addLog: async (logData) => {
    const newLog: AuditLog = {
      ...logData,
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    mockLogs.unshift(newLog);
    set({ logs: [...mockLogs] });
    await apiDelay(newLog);
  },
  addErrorType: async (errorTypeData) => {
    const newErrorType = { ...errorTypeData, id: `et-${Date.now()}` };
    mockErrorTypes.push(newErrorType);
    set(state => ({ errorTypes: [...state.errorTypes, newErrorType] }));
    await apiDelay(newErrorType);
  },
  addBulkErrorTypes: async (errorTypesData) => {
    const newErrorTypes: ErrorType[] = errorTypesData.map(et => ({
        ...et,
        id: `et-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));
    mockErrorTypes.push(...newErrorTypes);
    set({ errorTypes: [...mockErrorTypes] });
    await apiDelay(newErrorTypes);
  },
  updateErrorType: async (updatedErrorType) => {
    const etIndex = mockErrorTypes.findIndex(et => et.id === updatedErrorType.id);
    if(etIndex > -1) mockErrorTypes[etIndex] = updatedErrorType;
    set(state => ({ errorTypes: state.errorTypes.map(et => et.id === updatedErrorType.id ? updatedErrorType : et) }));
    await apiDelay(updatedErrorType);
  },
  deleteErrorType: async (errorTypeId) => {
    const etIndex = mockErrorTypes.findIndex(et => et.id === errorTypeId);
    if (etIndex > -1) {
        mockErrorTypes.splice(etIndex, 1);
    }
    set(state => ({ errorTypes: state.errorTypes.filter(et => et.id !== errorTypeId) }));
    await apiDelay(errorTypeId);
  },
  addMessage: async (messageData) => {
    const newMessage = { ...messageData, id: `msg-${Date.now()}` };
    mockMessages.push(newMessage);
    set(state => ({ messages: [...state.messages, newMessage] }));
    await apiDelay(newMessage);
  },
  addBulkMessages: async (messagesData) => {
    const newMessages: AutomatedMessage[] = messagesData.map(msg => ({
        ...msg,
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));
    mockMessages.push(...newMessages);
    set({ messages: [...mockMessages] });
    await apiDelay(newMessages);
  },
  updateMessage: async (updatedMessage) => {
    const msgIndex = mockMessages.findIndex(m => m.id === updatedMessage.id);
    if(msgIndex > -1) mockMessages[msgIndex] = updatedMessage;
    set(state => ({ messages: state.messages.map(m => m.id === updatedMessage.id ? updatedMessage : m) }));
    await apiDelay(updatedMessage);
  },
  deleteMessage: async (messageId) => {
    const msgIndex = mockMessages.findIndex(m => m.id === messageId);
    if (msgIndex > -1) {
        mockMessages.splice(msgIndex, 1);
    }
    set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
    await apiDelay(messageId);
  }
}));
