import { invoke } from "@tauri-apps/api/core";

export interface DeviceInfo {
  vendor_id: number;
  product_id: number;
  path: string;
  product_string: string | null;
}

export interface AppInfo {
  name: string;
  version: string;
}

export async function hidListDevices(filterZeroVidPid?: boolean): Promise<DeviceInfo[]> {
  return await invoke<DeviceInfo[]>("hid_list_devices", { filterZeroVidPid });
}

export async function hidOpen(path: string, frameSize: number): Promise<void> {
  return await invoke("hid_open", { path, frameSize });
}

export async function hidClose(): Promise<void> {
  return await invoke("hid_close");
}

export async function hidWrite(data: Uint8Array): Promise<void> {
  return await invoke("hid_write", { data });
}

export async function getAppInfo(): Promise<AppInfo> {
  return await invoke<AppInfo>("get_app_info");
}
