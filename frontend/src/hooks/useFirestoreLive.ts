"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  onSnapshot,
  type DocumentReference,
  type Query,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { useEffect } from "react";

/**
 * useFirestoreLive
 *
 * Bridges Firestore onSnapshot with TanStack Query cache.
 * Automatically updates the specified queryKey when the Firestore data changes.
 */
export function useFirestoreLive<T>(
  queryKey: QueryKey,
  ref: DocumentReference<T> | Query<T> | null,
  enabled: boolean = true,
): void {
  const queryClient = useQueryClient();
  const queryKeyString = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled || !ref) return;

    const unsubscribe = onSnapshot(
      ref as DocumentReference<T>,
      (snapshot: DocumentSnapshot<T> | QuerySnapshot<T>) => {
        if ("docs" in snapshot) {
          // It's a collection snapshot
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          queryClient.setQueryData(queryKey, data);
        } else {
          // It's a document snapshot
          if (snapshot.exists()) {
            queryClient.setQueryData(queryKey, {
              id: snapshot.id,
              ...snapshot.data(),
            });
          } else {
            queryClient.setQueryData(queryKey, null);
          }
        }
      },
      (error) => {
        console.error(`[FirestoreLive] Error for key ${queryKeyString}:`, error);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, queryKeyString, ref, enabled]);
}
