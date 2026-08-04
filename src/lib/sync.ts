import { apiGetProgress, apiPutProgress } from '../api/auth';
import { useProgressStore } from '../store/progress';
import { useToastStore } from '../store/toast';

/** 登录后同步进度：云端有数据则拉取覆盖，否则上传本机进度 */
export async function syncProgressAfterLogin(token: string): Promise<void> {
  const show = useToastStore.getState().show;
  try {
    const remote = await apiGetProgress(token);
    if (remote && remote.records && Object.keys(remote.records).length > 0) {
      useProgressStore.setState({
        records: remote.records as never,
        dailyWords: remote.dailyWords ?? {},
      });
      show('已同步云端学习进度', 'success');
    } else {
      const state = useProgressStore.getState();
      await apiPutProgress(token, {
        records: state.records as never,
        dailyWords: state.dailyWords,
      });
      show('已上传本机学习进度到云端', 'success');
    }
  } catch (e) {
    show(`进度同步失败：${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}
