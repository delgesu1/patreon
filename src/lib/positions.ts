import { supabase } from "./supabase";

/**
 * Recalculate positions for all non-cancelled signups in a meetup.
 * Priority signups come first, then by original position.
 */
export async function recalculatePositions(meetupId: string) {
  const { data: signups, error } = await supabase
    .from("signups")
    .select("id, has_priority, position")
    .eq("meetup_id", meetupId)
    .neq("status", "cancelled")
    .order("has_priority", { ascending: false })
    .order("position", { ascending: true });

  if (error) throw error;
  if (!signups || signups.length === 0) return;

  for (let i = 0; i < signups.length; i++) {
    const newPosition = i + 1;
    if (signups[i].position !== newPosition) {
      const { error: updateError } = await supabase
        .from("signups")
        .update({ position: newPosition })
        .eq("id", signups[i].id);
      if (updateError) throw updateError;
    }
  }
}
