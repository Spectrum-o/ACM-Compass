import React from 'react';
import { ConfigProvider, Layout, Tabs, Typography, theme } from 'antd';
import {
  BookOutlined, WarningOutlined, CheckCircleOutlined,
  TrophyOutlined, SyncOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import ProblemsPage from './pages/ProblemsPage';
import ContestsPage from './pages/ContestsPage';
import GitSyncPage from './pages/GitSyncPage';
import 'antd/dist/reset.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  const items = [
    {
      key: 'all',
      label: (
        <span>
          <BookOutlined />
          全部题目
        </span>
      ),
      children: <ProblemsPage filterMode="all" title="全部题目" />,
    },
    {
      key: 'unsolved',
      label: (
        <span>
          <WarningOutlined />
          未解决
        </span>
      ),
      children: <ProblemsPage filterMode="unsolved" title="未解决题目" />,
    },
    {
      key: 'solved',
      label: (
        <span>
          <CheckCircleOutlined />
          已解决
        </span>
      ),
      children: <ProblemsPage filterMode="solved" title="已解决题目" />,
    },
    {
      key: 'contests',
      label: (
        <span>
          <TrophyOutlined />
          比赛管理
        </span>
      ),
      children: <ContestsPage />,
    },
    {
      key: 'git',
      label: (
        <span>
          <SyncOutlined />
          Git 同步
        </span>
      ),
      children: <GitSyncPage />,
    },
  ];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Title level={3} style={{ margin: 0, marginRight: 16 }}>
              ACM Compass
            </Title>
            <Text type="secondary">题目与比赛追踪系统 - 及时补题才能有提升</Text>
          </div>
        </Header>
        <Content style={{ background: '#f5f5f5' }}>
          <Tabs
            items={items}
            size="large"
            tabBarStyle={{
              background: '#fff',
              padding: '0 24px',
              marginBottom: 0,
            }}
          />
        </Content>
        <Footer style={{ textAlign: 'center', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary">
            数据存储：data/problems.json | data/contests.json | data/solutions/*.md
          </Text>
          <br />
          <Text type="secondary">
            浏览器助手：打开 bookmarklet.html 获取浏览器导入工具
          </Text>
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
