export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  created_at: string;
  updated_at: string;
  state: string;
  body: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
  head: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
      clone_url: string;
    };
  };
}

export interface PRTestingResult {
  success: boolean;
  message: string;
  data?: {
    prNumber?: number;
    branch?: string;
    repoUrl?: string;
    repoName?: string;
    tempDir?: string;
    testResults?: string;
    pid?: number;
    port?: number;
  };
}
