import React, { useState, useEffect } from 'react';
import {
  Button, Form, Input, Space, message, Card, Typography, Row, Col, Divider, Alert
} from 'antd';
import {
  CloudDownloadOutlined, CloudUploadOutlined, SyncOutlined,
  FolderOpenOutlined, ReloadOutlined
} from '@ant-design/icons';
import { gitApi } from '@/services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

const GitSyncPage: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState(
    `update data (${dayjs().format('YYYY-MM-DD HH:mm:ss')})`
  );
  const [repoOutput, setRepoOutput] = useState('');
  const [gitOutput, setGitOutput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await gitApi.getConfig();
      setRepoUrl(config.repo_url || '');
      setBranch(config.branch || 'main');
    } catch {
      // Config not found, use defaults
    }
  };

  const loadStatus = async () => {
    try {
      const status = await gitApi.getStatus();
      setRepoOutput(status);
    } catch {
      setRepoOutput('无法获取仓库状态');
    }
  };

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      message.warning('请先输入仓库地址');
      return;
    }
    setLoading('clone');
    try {
      const output = await gitApi.clone(repoUrl, branch);
      setRepoOutput(output);
      message.success('克隆完成');
    } catch (error) {
      message.error('克隆失败');
      setRepoOutput(String(error));
    } finally {
      setLoading(null);
    }
  };

  const handleBackupReclone = async () => {
    if (!repoUrl.trim()) {
      message.warning('请先输入仓库地址');
      return;
    }
    setLoading('backup');
    try {
      const output = await gitApi.backupAndReclone(repoUrl, branch);
      setRepoOutput(output);
      message.success('备份并重新克隆完成');
    } catch (error) {
      message.error('操作失败');
      setRepoOutput(String(error));
    } finally {
      setLoading(null);
    }
  };

  const handlePull = async () => {
    if (!repoUrl.trim()) {
      message.warning('请先输入仓库地址');
      return;
    }
    setLoading('pull');
    try {
      const output = await gitApi.pull(repoUrl, branch);
      setGitOutput(output);
      message.success('拉取完成');
    } catch (error) {
      message.error('拉取失败');
      setGitOutput(String(error));
    } finally {
      setLoading(null);
    }
  };

  const handlePush = async () => {
    if (!repoUrl.trim()) {
      message.warning('请先输入仓库地址');
      return;
    }
    setLoading('push');
    try {
      const output = await gitApi.push(repoUrl, branch, commitMessage);
      setGitOutput(output);
      message.success('推送完成');
      setCommitMessage(`update data (${dayjs().format('YYYY-MM-DD HH:mm:ss')})`);
    } catch (error) {
      message.error('推送失败');
      setGitOutput(String(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4}>Git 版本控制 - Data 独立仓库</Title>
        <Paragraph type="secondary">
          数据文件单独使用一个 Git 仓库进行版本控制
        </Paragraph>

        <Alert
          message="首次使用步骤"
          description={
            <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>在 GitHub/GitLab 等平台创建一个新的空仓库（或使用已有仓库）</li>
              <li>复制仓库的 HTTPS 或 SSH 地址（例如：https://github.com/username/acm-data.git）</li>
              <li>在下方输入仓库地址并点击"克隆 Data 仓库"</li>
              <li>远程仓库将被克隆为本地的 data/ 目录</li>
              <li>之后可以正常使用拉取和推送功能</li>
            </ol>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Divider>仓库配置</Divider>

        <Row gutter={16}>
          <Col span={18}>
            <Form.Item label="Git 仓库地址">
              <Input
                placeholder="https://github.com/username/acm-data.git 或 git@github.com:username/acm-data.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                prefix={<FolderOpenOutlined />}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="分支名称">
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={loading === 'clone'}
            onClick={handleClone}
          >
            克隆 Data 仓库
          </Button>
          <Button
            icon={<SyncOutlined />}
            loading={loading === 'backup'}
            onClick={handleBackupReclone}
          >
            备份并重新克隆
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadStatus}
          >
            查看仓库状态
          </Button>
        </Space>

        <TextArea
          value={repoOutput}
          rows={8}
          readOnly
          style={{ fontFamily: 'monospace', marginBottom: 24 }}
        />

        <Divider>拉取远程更新</Divider>
        <Paragraph type="secondary">从远程仓库拉取最新的数据变更</Paragraph>
        <Button
          size="large"
          icon={<CloudDownloadOutlined />}
          loading={loading === 'pull'}
          onClick={handlePull}
          style={{ marginBottom: 24 }}
        >
          Git Pull (拉取远程更新)
        </Button>

        <Divider>推送本地更改</Divider>
        <Paragraph type="secondary">将本地数据变更推送到远程仓库</Paragraph>

        <Form.Item label="提交说明">
          <Input
            placeholder="描述本次更改..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            style={{ marginBottom: 16 }}
          />
        </Form.Item>

        <Button
          type="primary"
          size="large"
          icon={<CloudUploadOutlined />}
          loading={loading === 'push'}
          onClick={handlePush}
          style={{ marginBottom: 24 }}
        >
          Git Push (推送到远程)
        </Button>

        <TextArea
          value={gitOutput}
          rows={15}
          readOnly
          style={{ fontFamily: 'monospace' }}
          placeholder="Git 操作日志"
        />

        <Divider>使用说明</Divider>
        <Alert
          message="操作指南"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li><strong>首次使用：</strong>输入远程仓库地址和分支名称，点击"克隆 Data 仓库"</li>
              <li><strong>日常使用：</strong>开始工作前点击"拉取远程更新"，完成后点击"推送到远程"</li>
              <li><strong>多人协作：</strong>定期拉取更新，避免冲突</li>
              <li><strong>切换仓库：</strong>使用"备份并重新克隆"按钮</li>
              <li><strong>注意：</strong>仓库地址会自动保存，下次打开自动加载</li>
            </ul>
          }
          type="info"
        />
      </Card>
    </div>
  );
};

export default GitSyncPage;
