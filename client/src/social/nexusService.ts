import { supabase } from '../config/supabase';
import type { UserProfile, FriendWithProfile, FriendMessage, Challenge } from '../types';

// ─── Profile ─────────────────────────────────────────────────
export async function getOrCreateProfile(
  userId: string,
  email: string,
  displayName?: string,
): Promise<UserProfile | null> {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const dn = displayName ?? existing.display_name;
    if (dn && dn !== existing.display_name) {
      const { data: updated } = await supabase
        .from('user_profiles')
        .update({ display_name: dn })
        .eq('user_id', userId)
        .select()
        .single();
      return (updated ?? existing) as UserProfile;
    }
    return existing as UserProfile;
  }

  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const { data: created, error } = await supabase
    .from('user_profiles')
    .insert({ user_id: userId, username, display_name: displayName ?? username, public_stats: {} })
    .select()
    .single();

  if (error) { console.error('[nexus profile]', error); return null; }
  return created as UserProfile;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ display_name: displayName })
    .eq('user_id', userId);
}

export async function updatePublicStats(userId: string, stats: Record<string, number>): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ public_stats: stats })
    .eq('user_id', userId);
}

export async function searchProfiles(query: string, currentUserId: string): Promise<UserProfile[]> {
  const normalized = query.includes('@') ? query.split('@')[0] : query;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .neq('user_id', currentUserId)
    .or(`username.ilike.%${normalized}%,display_name.ilike.%${normalized}%`)
    .limit(8);

  if (error) { console.error('[nexus search]', error); return []; }
  return (data ?? []) as UserProfile[];
}

// ─── Friendships ─────────────────────────────────────────────
export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) { console.error('[nexus sendRequest]', error); }
  return !error;
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  return !error;
}

export async function declineFriendRequest(friendshipId: string): Promise<boolean> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  return !error;
}

export async function getFriends(userId: string): Promise<FriendWithProfile[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const friendIds = data.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', friendIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p as UserProfile]));

  return data.map(f => {
    const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
    return { ...f, profile: profileMap.get(friendId) ?? { user_id: friendId, username: null, display_name: null, public_stats: {}, created_at: '' } };
  }) as FriendWithProfile[];
}

export async function getPendingRequests(userId: string): Promise<FriendWithProfile[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return [];

  const requesterIds = data.map(f => f.requester_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', requesterIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p as UserProfile]));

  return data.map(f => ({
    ...f,
    profile: profileMap.get(f.requester_id) ?? { user_id: f.requester_id, username: null, display_name: null, public_stats: {}, created_at: '' },
  })) as FriendWithProfile[];
}

// ─── Messages ────────────────────────────────────────────────
export async function getMessages(userId: string, friendId: string, limit = 60): Promise<FriendMessage[]> {
  const { data, error } = await supabase
    .from('friend_messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) { console.error('[nexus getMessages]', error); return []; }
  return (data ?? []) as FriendMessage[];
}

export async function sendMessage(senderId: string, recipientId: string, text: string): Promise<FriendMessage | null> {
  const { data, error } = await supabase
    .from('friend_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, text })
    .select()
    .single();

  if (error) { console.error('[nexus sendMessage]', error); return null; }
  return data as FriendMessage;
}

// ─── Challenges ──────────────────────────────────────────────
export async function getChallenges(userId: string, friendId: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .or(`and(creator_id.eq.${userId},target_id.eq.${friendId}),and(creator_id.eq.${friendId},target_id.eq.${userId})`)
    .order('created_at', { ascending: false });

  if (error) { console.error('[nexus getChallenges]', error); return []; }
  return (data ?? []) as Challenge[];
}

export async function createChallenge(
  creatorId: string,
  targetId: string,
  title: string,
  category: string,
  targetValue: number | null,
  unit: string | null,
  endDate: string | null,
): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({ creator_id: creatorId, target_id: targetId, title, category, target_value: targetValue, unit, end_date: endDate })
    .select()
    .single();

  if (error) { console.error('[nexus createChallenge]', error); return null; }
  return data as Challenge;
}

export async function updateChallengeProgress(
  challengeId: string,
  isCreator: boolean,
  progress: number,
): Promise<boolean> {
  const field = isCreator ? 'creator_progress' : 'target_progress';
  const { error } = await supabase
    .from('challenges')
    .update({ [field]: progress })
    .eq('id', challengeId);
  return !error;
}

export async function completeChallenge(challengeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'completed' })
    .eq('id', challengeId);
  return !error;
}
