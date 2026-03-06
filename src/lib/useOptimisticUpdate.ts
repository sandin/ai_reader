'use client';

import { useState, useCallback } from 'react';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (result: unknown) => void;
  onError?: (error: Error, previousState: T) => void;
  errorMessage?: string;
}

/**
 * 乐观更新 hook
 * 用于在异步操作成功后自动更新状态，失败时回滚并提示错误
 *
 * @param initialState 初始状态
 * @param options 配置选项
 * @returns [state, setOptimisticState, executeWithOptimisticUpdate]
 */
export function useOptimisticUpdate<T>(
  initialState: T,
  options: OptimisticUpdateOptions<T> = {}
) {
  const [state, setState] = useState<T>(initialState);

  const setOptimisticState = useCallback((updater: T | ((prev: T) => T)) => {
    setState(updater);
  }, []);

  const executeWithOptimisticUpdate = useCallback(
    async (
      optimisticUpdate: T | ((prev: T) => T),
      asyncFn: () => Promise<unknown>,
      rollback?: T | ((prev: T) => T)
    ) => {
      // 保存当前状态用于回滚
      const previousState = state;

      // 立即应用乐观更新
      setState(optimisticUpdate);

      try {
        await asyncFn();
        options.onSuccess?.(undefined);
      } catch (error) {
        const errorMessage = options.errorMessage || '操作失败';
        console.error(errorMessage, error);

        // 回滚状态
        if (rollback) {
          setState(rollback);
        } else {
          setState(previousState);
        }

        // 调用错误回调
        options.onError?.(error as Error, previousState);

        // 显示错误提示
        alert(errorMessage);
      }
    },
    [state, options]
  );

  return [state, setOptimisticState, executeWithOptimisticUpdate] as const;
}

/**
 * 简化的乐观更新函数，适用于单次操作
 *
 * @param setState setState 函数
 * @param asyncFn 异步操作函数
 * @param optimisticUpdate 乐观更新
 * @param rollback 回滚值（可选）
 * @param errorMessage 错误提示（可选）
 */
export async function withOptimisticUpdate<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  asyncFn: () => Promise<unknown>,
  optimisticUpdate: T | ((prev: T) => T),
  rollback?: T | ((prev: T) => T),
  errorMessage = '操作失败'
): Promise<boolean> {
  // 保存当前状态用于回滚
  let previousState: T;

  setState((prev) => {
    previousState = prev;
    return typeof optimisticUpdate === 'function'
      ? (optimisticUpdate as (prev: T) => T)(prev)
      : optimisticUpdate;
  });

  try {
    await asyncFn();
    return true;
  } catch (error) {
    console.error(errorMessage, error);

    // 回滚状态
    setState((prev) =>
      rollback
        ? typeof rollback === 'function'
          ? (rollback as (prev: T) => T)(prev)
          : rollback
        : previousState!
    );

    // 显示错误提示
    alert(errorMessage);
    return false;
  }
}
