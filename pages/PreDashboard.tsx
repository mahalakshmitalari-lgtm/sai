import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTicketStore, useSessionStore, useAdminStore } from '../store';
import { Ticket, TicketStatus, ErrorType, SystemNotification } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Badge } from '../components/ui';
import { ICONS } from '../constants';
import { convertToCSV, downloadCSV } from '../utils';

const StatCard: React.FC<{ title: string, value: string | number, description: string }> = ({ title, value, description }) => (
    <Card>
        <CardHeader>
            <CardDescription>{title}</CardDescription>
            <CardTitle>{value}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-xs text-slate-500">{description}</p>
        </CardContent>
    </Card>
);

const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
    const variant = {
        [TicketStatus.COMPLETED]: 'success',
        [TicketStatus.IN_PROGRESS]: 'warning',
        [TicketStatus.ESCALATED]: 'danger',
        [TicketStatus.CLOSED]: 'default',
    }[status] as 'success' | 'warning' | 'danger' | 'default';
    return <Badge variant={variant}>{status}</Badge>;
};

const TicketForm: React.FC<{ errorTypes: ErrorType[], onSubmit: () => void }> = ({ errorTypes, onSubmit }) => {
    const { addTicket } = useTicketStore();
    const [uid, setUid] = useState('');
    const [errorTypeId, setErrorTypeId] = useState('');
    const [description, setDescription] = useState('');
    const [comment, setComment] = useState('');
    const [subject, setSubject] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{status: 'idle' | 'success' | 'error', message: string}>({status: 'idle', message: ''});


    const isEmailErrorType = useMemo(() => {
        const emailErrorType = errorTypes.find(et => et.name === 'Email');
        return emailErrorType && errorTypeId === emailErrorType.id;
    }, [errorTypes, errorTypeId]);

    useEffect(() => {
        if (errorTypes.length > 0 && !errorTypeId) {
            setErrorTypeId(errorTypes[0].id);
        }
    }, [errorTypes, errorTypeId]);

    useEffect(() => {
        if (!isEmailErrorType) {
            setSubject('');
        }
    }, [isEmailErrorType]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid || !errorTypeId || !description || (isEmailErrorType && !subject)) return;
        
        setIsSubmitting(true);
        setSubmitStatus({ status: 'idle', message: '' });

        try {
            const attachmentData = attachment ? {
                name: attachment.name,
                type: attachment.type,
                size: attachment.size
            } : undefined;

            await addTicket({ 
                uid, 
                errorTypeId, 
                description, 
                comment, 
                subject: isEmailErrorType ? subject : undefined, 
                attachment: attachmentData 
            });

            setUid('');
            setErrorTypeId(errorTypes[0]?.id || '');
            setDescription('');
            setComment('');
            setSubject('');
            setAttachment(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setSubmitStatus({ status: 'success', message: 'Ticket submitted successfully!' });
            setTimeout(() => setSubmitStatus({ status: 'idle', message: '' }), 5000);
            onSubmit();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
            setSubmitStatus({ status: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Create New Ticket</CardTitle>
                <CardDescription>Fill out the form to report an issue.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="uid">UID</Label>
                        <Input id="uid" value={uid} onChange={e => setUid(e.target.value)} placeholder="e.g., UID12345" required />
                    </div>
                    <div>
                        <Label htmlFor="errorType">Error Type</Label>
                        <Select id="errorType" value={errorTypeId} onChange={e => setErrorTypeId(e.target.value)} required>
                            {errorTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                        </Select>
                    </div>
                    {isEmailErrorType && (
                        <div>
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter email subject" required />
                        </div>
                    )}
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue in detail..." required />
                    </div>
                    <div>
                        <Label htmlFor="comment">Comment (Optional)</Label>
                        <Input id="comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Any additional comments?" />
                    </div>
                    <div>
                        <Label htmlFor="attachment">Attachment (Optional)</Label>
                        <Input id="attachment" type="file" ref={fileInputRef} onChange={handleFileChange} className="pt-2" />
                        {attachment && (
                            <p className="text-xs text-slate-500 mt-1">Selected: {attachment.name} ({(attachment.size / 1024).toFixed(2)} KB)</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                    </Button>
                    {submitStatus.status === 'success' && (
                        <p className="text-sm text-green-600 mt-2 text-center">{submitStatus.message}</p>
                    )}
                    {submitStatus.status === 'error' && (
                        <p className="text-sm text-red-600 mt-2 text-center">{submitStatus.message}</p>
                    )}
                </form>
            </CardContent>
        </Card>
    );
};

const FeedbackForm: React.FC = () => {
    const { addFeedback } = useTicketStore();
    const [feedback, setFeedback] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback.trim()) return;
        await addFeedback({ feedback });
        setFeedback('');
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Submit Feedback</CardTitle>
                <CardDescription>Have suggestions or issues? Let us know.</CardDescription>
            </CardHeader>
            <CardContent>
                {submitted ? (
                    <div className="flex items-center justify-center h-full p-4 bg-green-50 rounded-lg">
                        <p className="text-green-700 font-medium">Thank you for your feedback!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="feedback">Your Feedback</Label>
                            <Textarea id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Tell us what you think..." required />
                        </div>
                        <Button type="submit" className="w-full">Submit Feedback</Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
};

const TicketTable: React.FC<{ tickets: Ticket[], errorTypes: ErrorType[] }> = ({ tickets, errorTypes }) => {
    const getErrorTypeName = (id: string) => errorTypes.find(et => et.id === id)?.name || 'Unknown';
    const [copiedUid, setCopiedUid] = useState<string | null>(null);

    const handleCopyUid = (uid: string) => {
        navigator.clipboard.writeText(uid);
        setCopiedUid(uid);
        setTimeout(() => setCopiedUid(null), 2000);
    };

    const handleDownload = () => {
        const headers = [
            { key: 'id', label: 'Ticket ID' },
            { key: 'uid', label: 'UID' },
            { key: 'errorType', label: 'Error Type' },
            { key: 'subject', label: 'Subject' },
            { key: 'status', label: 'Status' },
            { key: 'dataCrComment', label: 'DataCR Comments' },
            { key: 'attachment', label: 'Attachment' },
            { key: 'lastUpdated', label: 'Last Updated' },
        ];
        
        const dataToExport = tickets.map(ticket => ({
            id: ticket.id,
            uid: ticket.uid,
            errorType: getErrorTypeName(ticket.errorTypeId),
            subject: ticket.subject || '-',
            status: ticket.status,
            dataCrComment: ticket.comment || '-',
            attachment: ticket.attachment ? ticket.attachment.name : '-',
            lastUpdated: new Date(ticket.updatedAt).toLocaleDateString(),
        }));

        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `my-tickets-${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>My Submitted Tickets</CardTitle>
                        <CardDescription>A list of all the tickets you have submitted.</CardDescription>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleDownload}>
                        <span className="mr-2">{ICONS.download}</span>
                        Download
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ticket ID</TableHead>
                            <TableHead>UID</TableHead>
                            <TableHead>Error Type</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>DataCR Comments</TableHead>
                            <TableHead>Attachment</TableHead>
                            <TableHead>Last Updated</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tickets.length > 0 ? tickets.map(ticket => (
                            <TableRow key={ticket.id}>
                                <TableCell>{ticket.id}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{ticket.uid}</span>
                                        <button
                                            onClick={() => handleCopyUid(ticket.uid)}
                                            className="text-slate-400 hover:text-sky-600 p-1 rounded-md transition-colors"
                                            aria-label={`Copy UID ${ticket.uid}`}
                                        >
                                            {copiedUid === ticket.uid ? <span className="text-green-500">{ICONS.check}</span> : ICONS.copy}
                                        </button>
                                    </div>
                                </TableCell>
                                <TableCell>{getErrorTypeName(ticket.errorTypeId)}</TableCell>
                                <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={ticket.subject || ''}>{ticket.subject || '–'}</TableCell>
                                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                                <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={ticket.comment ?? ''}>{ticket.comment || '–'}</TableCell>
                                <TableCell>
                                    {ticket.attachment ? (
                                        <div className="flex items-center gap-2 text-slate-600" title={`${ticket.attachment.name} (${(ticket.attachment.size / 1024).toFixed(2)} KB)`}>
                                            {ICONS.paperclip}
                                            <span className="truncate text-sm">{ticket.attachment.name}</span>
                                        </div>
                                    ) : '–'}
                                </TableCell>
                                <TableCell>{new Date(ticket.updatedAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">You haven't submitted any tickets yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export const PreDashboard: React.FC<{ activePage: string }> = ({ activePage }) => {
    const { user } = useSessionStore();
    const { tickets, fetchTickets, notifications, kpis, calculateKPIs } = useTicketStore();
    const { errorTypes, fetchAdminData } = useAdminStore();
    const [refreshKey, setRefreshKey] = useState(0);

    const myTickets = useMemo(() => tickets.filter(t => t.preId === user?.id), [tickets, user]);

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);
    
    useEffect(() => {
        if(user) {
            calculateKPIs(myTickets);
        }
    }, [myTickets, user, calculateKPIs]);

    const myNotifications = notifications.filter(n => n.preId === user?.id);

    const DashboardView = () => (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <StatCard title="My Active Tickets" value={kpis.activeTickets} description="Tickets you've submitted that are in progress." />
                <StatCard title="My Closed Tickets" value={kpis.closedTickets} description="Tickets you've submitted that are resolved." />
                <StatCard title="My Avg. Resolution Time" value={kpis.avgTimeToSolve} description="Average time taken to resolve your tickets." />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                 <div>
                    <TicketForm errorTypes={errorTypes} onSubmit={() => setRefreshKey(k => k + 1)} />
                </div>
                 <Card>
                    <CardHeader><CardTitle>System Messages</CardTitle></CardHeader>
                    <CardContent>
                        {myNotifications.length > 0 ? (
                            <ul className="space-y-3 max-h-[425px] overflow-y-auto pr-2">
                                {myNotifications.map(notif => (
                                    <li key={notif.id} className="p-3 bg-sky-50 rounded-lg text-sm">
                                        <div className="flex justify-between items-start gap-4">
                                            <p className="text-slate-700">{notif.message}</p>
                                            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                                                {new Date(notif.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-slate-500">No system messages.</p>}
                    </CardContent>
                </Card>
            </div>
            <TicketTable tickets={myTickets} errorTypes={errorTypes} />
        </>
    );

    const renderPageContent = () => {
        switch(activePage) {
            case 'feedback':
                return <FeedbackForm />;
            case 'dashboard':
            default:
                return <DashboardView />;
        }
    }

    return <div className="space-y-6">{renderPageContent()}</div>;
};