// LN

export interface LNTicketDataInfo {
    number?: string;
    code: string;
}

// General

export interface TicketData {
    info: LNTicketDataInfo; // Add other game interfaces here with || operator
}