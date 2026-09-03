import Axios, { AxiosError } from "axios";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: "https://api-tap-fun-chainlink.nysm.work",
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const storageAddress = localStorage.getItem("wallet-address");
  if (storageAddress) {
    config.headers["wallet-address"] = storageAddress;
  }

  return config;
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor to handle 401 unauthorized
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Check if response status is 401
    if (error.response?.status === 401) {
      // Clear authentication data from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("wallet-address");

        // Dispatch custom event for components to handle logout
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    return Promise.reject(error);
  },
);

export const customClient = <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    url,
    method: options?.method,
    headers: options?.headers as any,
    data: options?.body,
    signal: options?.signal as any,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-expect-error - promise cancel
  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;

export type BodyType<BodyData> = BodyData;
