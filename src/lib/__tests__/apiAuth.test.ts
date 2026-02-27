import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module before importing apiAuth
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => {
      const response = {
        body,
        status: init?.status ?? 200,
        json: async () => body,
      };
      return response;
    },
  },
}));

import {
  authenticateRequest,
  unauthorizedResponse,
  forbiddenResponse,
} from '../apiAuth';

describe('authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up the chainable mock: from().select().eq().single()
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('should return null when x-user-id header is missing', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: {},
    });

    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it('should return null when user is not found in database', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-user-id': 'nonexistent-user' },
    });

    const result = await authenticateRequest(req);
    expect(result).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('should return userId when user exists in database', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user-123', role: 'parent' },
      error: null,
    });

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-user-id': 'user-123' },
    });

    const result = await authenticateRequest(req);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-123');
  });

  it('should include facilityId when x-facility-id header is present', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user-123', role: 'admin' },
      error: null,
    });

    const req = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': 'user-123',
        'x-facility-id': 'facility-456',
      },
    });

    const result = await authenticateRequest(req);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-123');
    expect(result!.facilityId).toBe('facility-456');
  });

  it('should return undefined facilityId when x-facility-id header is absent', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user-123', role: 'parent' },
      error: null,
    });

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-user-id': 'user-123' },
    });

    const result = await authenticateRequest(req);
    expect(result).not.toBeNull();
    expect(result!.facilityId).toBeUndefined();
  });

  it('should query the users table with correct parameters', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'user-abc', role: 'staff' },
      error: null,
    });

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-user-id': 'user-abc' },
    });

    await authenticateRequest(req);

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalledWith('id, role');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-abc');
    expect(mockSingle).toHaveBeenCalled();
  });
});

describe('unauthorizedResponse', () => {
  it('should return a 401 response with default message', () => {
    const response = unauthorizedResponse() as unknown as { body: { error: string }; status: number };
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('認証が必要です');
  });

  it('should return a 401 response with custom message', () => {
    const response = unauthorizedResponse('カスタムエラー') as unknown as {
      body: { error: string };
      status: number;
    };
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('カスタムエラー');
  });
});

describe('forbiddenResponse', () => {
  it('should return a 403 response with default message', () => {
    const response = forbiddenResponse() as unknown as { body: { error: string }; status: number };
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('この操作を行う権限がありません');
  });

  it('should return a 403 response with custom message', () => {
    const response = forbiddenResponse('アクセス拒否') as unknown as {
      body: { error: string };
      status: number;
    };
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('アクセス拒否');
  });
});
