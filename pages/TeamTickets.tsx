import React, { useEffect, useState, useMemo } from 'react';
import { useTicketStore, useAdminStore, useSessionStore } from '../store';
import { Ticket, TicketStatus, User, ErrorType } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '../components/ui';
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

const getSubordinateIds = (managerId: string, allUsers: User[]): string[] => {
    const subordinates: string[] = [];
    const queue: string[] = [managerId];
    const visited: Set<string> = new Set([managerId]); // Start with manager to avoid self-listing

    let head = 0;
    while(head < queue.length) {
        const currentManagerId = queue[head++];
        
        const directSubordinates = allUsers.filter(u => u.managerId === currentManagerId);

        for (const subordinate of directSubordinates) {
            if (!visited.has(subordinate.id)) {
                visited.add(subordinate.id);
                subordinates.push(subordinate.id);
                queue.push(subordinate.id);
            }
        }
    }
    return subordinates;
};


export const TeamTickets: React.FC = () => {
    const { user } = useSessionStore();
    const { tickets, fetchTickets, kpis, calculateKPIs } = useTicketStore();
    const { users, errorTypes, fetchAdminData } = useAdminStore();
    const [filter, setFilter] = useState('');
    const [copiedUid, setCopiedUid] = useState<string | null>(null);

    useEffect(() => {
        fetchTickets();
        fetchAdminData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const teamTickets = useMemo(() => {
        if (!user || users.length === 0) return [];
        
        const subordinateIds = getSubordinateIds(user.id, users);
        const allTeamTickets = tickets.filter(ticket => subordinateIds.includes(ticket.preId));

        return allTeamTickets.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [user, users, tickets]);

    useEffect(() => {
        if (user && teamTickets.length > 0) {
            calculateKPIs(teamTickets);
        }
    }, [teamTickets, user, calculateKPIs]);

    const filteredTeamTickets = useMemo(() => {
        if (!filter) return teamTickets;
        const lowerFilter = filter.toLowerCase();
        return teamTickets.filter(t => 
            t.uid.toLowerCase().includes(lowerFilter) || 
            (users.find(u => u.id === t.preId)?.name.toLowerCase().includes(lowerFilter)) ||
            (errorTypes.find(et => et.id === t.errorTypeId)?.name.toLowerCase().includes(lowerFilter))
        );
    }, [teamTickets, filter, users, errorTypes]);
    
    const handleCopyUid = (uid: string) => {
        navigator.clipboard.writeText(uid);
        setCopiedUid(uid);
        setTimeout(() => setCopiedUid(null), 2000);
    };

    const getPreName = (preId: string) => users.find(u => u.id === preId)?.name || 'Unknown';
    const getErrorTypeName = (id: string) => errorTypes.find(et => et.id === id)?.name || 'Unknown';

    const handleDownload = () => {
        const headers = [
            { key: 'id', label: 'Ticket ID' },
            { key: 'uid', label: 'UID' },
            { key: 'submittedBy', label: 'Submitted By' },
            { key: 'errorType', label: 'Error Type' },
            { key: 'subject', label: 'Subject' },
            { key: 'status', label: 'Status' },
            { key: 'dataCrComment', label: 'DataCR Comments' },
            { key: 'attachment', label: 'Attachment' },
            { key: 'lastUpdated', label: 'Last Updated' },
        ];
        
        const dataToExport = filteredTeamTickets.map(ticket => ({
            id: ticket.id,
            uid: ticket.uid,
            submittedBy: getPreName(ticket.preId),
            errorType: getErrorTypeName(ticket.errorTypeId),
            subject: ticket.subject || '-',
            status: ticket.status,
            dataCrComment: ticket.comment || '-',
            attachment: ticket.attachment ? ticket.attachment.name : '-',
            lastUpdated: new Date(ticket.updatedAt).toLocaleDateString(),
        }));

        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, `team-tickets-${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Team's Active Tickets" value={kpis.activeTickets} description="Tickets for your team that are in progress." />
                <StatCard title="Team's Closed Tickets" value={kpis.closedTickets} description="Tickets for your team that are resolved." />
                <StatCard title="Team's Avg. Resolution Time" value={kpis.avgTimeToSolve} description="Average time taken to resolve a team ticket." />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Team Ticket Submissions</CardTitle>
                            <CardDescription>All tickets submitted by PREs in your hierarchy.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative w-64">
                                <Input placeholder="Search by UID, PRE, Error..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-10" />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ICONS.search}</span>
                            </div>
                            <Button variant="secondary" onClick={handleDownload}>
                                <span className="mr-2">{ICONS.download}</span>
                                Download Report
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ticket ID</TableHead>
                                <TableHead>UID</TableHead>
                                <TableHead>Submitted By</TableHead>
                                <TableHead>Error Type</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>DataCR Comments</TableHead>
                                <TableHead>Attachment</TableHead>
                                <TableHead>Last Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTeamTickets.length > 0 ? filteredTeamTickets.map(ticket => (
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
                                    <TableCell>{getPreName(ticket.preId)}</TableCell>
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
                                    <TableCell colSpan={9} className="text-center">No tickets found for your team.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};