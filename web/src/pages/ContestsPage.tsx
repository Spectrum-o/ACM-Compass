import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Form, Input, InputNumber, Select, Space, DatePicker,
  message, Modal, Card, Typography, Tag, Row, Col, Divider, Alert, Badge
} from 'antd';
import {
  EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, ClearOutlined, ImportOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { contestApi } from '@/services/api';
import type { Contest, ContestInput, ContestProblem, ContestStatus } from '@/types';
import { LETTERS } from '@/types';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_OPTIONS: { value: ContestStatus; label: string; color: string }[] = [
  { value: 'unsubmitted', label: '未提交', color: 'default' },
  { value: 'attempted', label: '已尝试', color: 'warning' },
  { value: 'ac', label: 'AC', color: 'success' },
];

const ContestsPage: React.FC = () => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [totalProblems, setTotalProblems] = useState(12);
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [form] = Form.useForm();

  // 待导入数据状态
  const [hasPendingContest, setHasPendingContest] = useState(false);
  const [hasPendingProblems, setHasPendingProblems] = useState(false);
  const [pendingContestName, setPendingContestName] = useState('');
  const [pendingProblemsCount, setPendingProblemsCount] = useState(0);

  const initProblems = useCallback((count: number, existing?: ContestProblem[]) => {
    const newProblems: ContestProblem[] = [];
    for (let i = 0; i < count; i++) {
      if (existing && i < existing.length) {
        newProblems.push(existing[i]);
      } else {
        newProblems.push({
          letter: LETTERS[i],
          pass_count: 0,
          attempt_count: 0,
          my_status: 'unsubmitted',
        });
      }
    }
    setProblems(newProblems);
  }, []);

  const loadContests = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0]?.format('YYYY-MM-DD');
      const endDate = dateRange[1]?.format('YYYY-MM-DD');
      const data = await contestApi.list(startDate, endDate);
      setContests(data);
    } catch {
      message.error('加载比赛列表失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 检查待导入数据状态
  const checkPendingData = useCallback(async () => {
    try {
      // 检查比赛数据
      const contestData = await contestApi.getPendingImport();
      if (contestData) {
        setHasPendingContest(true);
        setPendingContestName(contestData.name || '');
      } else {
        setHasPendingContest(false);
        setPendingContestName('');
      }

      // 检查题目数据
      const problemsResponse = await fetch('/api/pending_problems');
      const problemsResult = await problemsResponse.json();
      if (problemsResult.data) {
        setHasPendingProblems(true);
        setPendingProblemsCount(problemsResult.data.problems?.length || 0);
      } else {
        setHasPendingProblems(false);
        setPendingProblemsCount(0);
      }
    } catch (err) {
      console.error('检查待导入数据失败:', err);
    }
  }, []);

  useEffect(() => {
    loadContests();
    checkPendingData();
    // 初始化表单
    initProblems(12);
  }, [loadContests, checkPendingData]);

  // 当题目数量改变时更新题目列表
  const handleTotalProblemsChange = (value: number | null) => {
    const newTotal = value || 12;
    setTotalProblems(newTotal);
    initProblems(newTotal, problems);
  };

  const handleClearForm = () => {
    setEditingContest(null);
    form.resetFields();
    form.setFieldsValue({ total_problems: 12 });
    setTotalProblems(12);
    initProblems(12);
    setStatusMsg('');
  };

  const handleEdit = (record: Contest) => {
    setEditingContest(record);
    form.setFieldsValue({
      name: record.name,
      total_problems: record.total_problems,
      rank_str: record.rank_str || '',
      summary: record.summary || '',
    });
    setTotalProblems(record.total_problems);
    initProblems(record.total_problems, record.problems);
    setStatusMsg(`已加载比赛: ${record.name}`);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这场比赛吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await contestApi.delete(id);
          message.success('删除成功');
          if (editingContest?.id === id) {
            handleClearForm();
          }
          loadContests();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleProblemChange = (index: number, field: keyof ContestProblem, value: number | ContestStatus) => {
    const newProblems = [...problems];
    newProblems[index] = { ...newProblems[index], [field]: value };
    setProblems(newProblems);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const data: ContestInput = {
        name: values.name.trim(),
        total_problems: totalProblems,
        problems: problems.slice(0, totalProblems),
        rank_str: values.rank_str?.trim() || null,
        summary: values.summary?.trim() || null,
      };

      if (editingContest) {
        await contestApi.update(editingContest.id, data);
        setStatusMsg(`✓ 已更新比赛: ${values.name}`);
        message.success('更新成功');
      } else {
        await contestApi.create(data);
        setStatusMsg(`✓ 已添加比赛: ${values.name}`);
        message.success('添加成功');
      }

      handleClearForm();
      loadContests();
    } catch {
      message.error('保存失败');
    }
  };

  const handleLoadImport = async () => {
    // 从服务器获取待导入数据
    try {
      const response = await fetch('/api/pending_import');
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const pendingImportData = result.data;
          setEditingContest(null);
          form.setFieldsValue({
            name: pendingImportData.name || '',
            total_problems: pendingImportData.total_problems || 12,
            rank_str: pendingImportData.user_rank || '',
            summary: '',
          });
          setTotalProblems(pendingImportData.total_problems || 12);
          initProblems(pendingImportData.total_problems || 12, pendingImportData.problems || []);
          setStatusMsg(`✓ 已加载比赛数据: ${pendingImportData.name}，可点击「确认导入」保存数据`);
          message.success('已加载导入的数据');
          return;
        }
      }
      message.info('没有待导入的数据，请先在比赛页面使用书签工具导入');
    } catch (err) {
      console.error('获取待导入数据失败:', err);
      message.error('获取待导入数据失败，请检查服务器连接');
    }
  };

  // 确认导入：同时保存比赛和题目
  const handleConfirmImport = async () => {
    if (!hasPendingContest && !hasPendingProblems) {
      message.warning('没有待导入的数据');
      return;
    }

    Modal.confirm({
      title: '确认导入',
      content: (
        <div>
          <p>即将导入以下数据：</p>
          {hasPendingContest && <p>- 比赛：{pendingContestName}</p>}
          {hasPendingProblems && <p>- 题目：{pendingProblemsCount} 道</p>}
          <p>确认导入吗？</p>
        </div>
      ),
      okText: '确认导入',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await contestApi.confirmImport();
          if (result.success) {
            const messages: string[] = [];
            if (result.results?.contest) {
              messages.push(result.results.contest.message);
            }
            if (result.results?.problems) {
              messages.push(result.results.problems.message);
            }
            message.success(messages.join('；'));
            setStatusMsg(`✓ ${messages.join('；')}`);

            // 刷新状态
            handleClearForm();
            loadContests();
            checkPendingData();
          } else {
            message.error(result.message || '导入失败');
          }
        } catch (err) {
          console.error('确认导入失败:', err);
          message.error('导入失败，请检查服务器连接');
        }
      },
    });
  };

  // 清除待导入数据
  const handleClearPending = async () => {
    Modal.confirm({
      title: '清除待导入数据',
      content: '确定要清除所有待导入的数据吗？',
      okText: '清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await contestApi.clearPendingImport();
          await fetch('/api/pending_problems', { method: 'DELETE' });
          checkPendingData();
          message.success('已清除待导入数据');
        } catch (err) {
          console.error('清除失败:', err);
          message.error('清除失败');
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
      render: (text: string, record: Contest) => (
        <a onClick={() => handleEdit(record)} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text.slice(0, 8)}...
        </a>
      ),
    },
    {
      title: '比赛名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '题目数',
      dataIndex: 'total_problems',
      key: 'total_problems',
      width: 80,
    },
    {
      title: '通过数',
      key: 'solved',
      width: 100,
      render: (_: unknown, record: Contest) => {
        const solved = record.problems?.filter((p) => p.my_status === 'ac').length || 0;
        return `${solved}/${record.total_problems}`;
      },
    },
    {
      title: '排名',
      dataIndex: 'rank_str',
      key: 'rank_str',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Contest) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4}>使用浏览器书签导入比赛数据</Title>
        <Text type="secondary">打开 bookmarklet.html 获取浏览器书签工具，在 qoj.ac/ucup.ac 的 standings 页面点击即可导入</Text>

        {/* 待导入数据状态提示 */}
        {(hasPendingContest || hasPendingProblems) && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 16 }}
            message="有待导入的数据"
            description={
              <div>
                {hasPendingContest && (
                  <div><Badge status="processing" /> 比赛：{pendingContestName}</div>
                )}
                {hasPendingProblems && (
                  <div><Badge status="processing" /> 题目：{pendingProblemsCount} 道</div>
                )}
              </div>
            }
            action={
              <Space direction="vertical">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirmImport}
                >
                  确认导入
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={handleClearPending}
                  size="small"
                >
                  清除
                </Button>
              </Space>
            }
          />
        )}

        <div style={{ marginTop: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={handleLoadImport}
            >
              加载导入的数据
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={checkPendingData}
            >
              刷新状态
            </Button>
          </Space>
        </div>

        <Divider />

        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>比赛列表</Title>
          </Col>
          <Col>
            <Space>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                placeholder={['开始日期', '结束日期']}
              />
              <Button icon={<SearchOutlined />} onClick={loadContests}>
                按日期筛选
              </Button>
              <Button icon={<ClearOutlined />} onClick={() => setDateRange([null, null])}>
                清除日期
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadContests}>
                刷新列表
              </Button>
            </Space>
          </Col>
        </Row>

        <Text type="secondary">点击表格中的比赛ID可快速加载到编辑表单</Text>

        <Table
          columns={columns}
          dataSource={contests}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          style={{ marginTop: 8 }}
        />

        <Divider />

        {/* 编辑表单区域 */}
        <Title level={4}>新增 / 编辑比赛</Title>
        <Text type="secondary">点击表格中的比赛ID可快速加载到编辑表单</Text>

        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="比赛ID（自动生成，编辑时自动填充）">
                <Input
                  value={editingContest?.id || ''}
                  disabled
                  placeholder="新建比赛时自动生成"
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" ">
                <Button icon={<ClearOutlined />} onClick={handleClearForm}>
                  清空表单
                </Button>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="* 比赛名称"
                rules={[{ required: true, message: '请输入比赛名称' }]}
              >
                <Input placeholder="例如：Codeforces Round 900" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="total_problems" label="题目数量" initialValue={12}>
                <InputNumber
                  min={1}
                  max={26}
                  value={totalProblems}
                  onChange={handleTotalProblemsChange}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="rank_str" label="排名">
                <Input placeholder="例如：10/150" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="summary" label="赛后总结">
            <TextArea rows={4} placeholder="比赛总结、反思等..." />
          </Form.Item>

          <Title level={5}>题目统计 (A-{LETTERS[totalProblems - 1]})</Title>

          <div style={{ marginBottom: 16 }}>
            {problems.slice(0, totalProblems).map((problem, index) => (
              <Row key={problem.letter} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                <Col span={2}>
                  <Text strong>{problem.letter}</Text>
                </Col>
                <Col span={6}>
                  <InputNumber
                    addonBefore="通过"
                    min={0}
                    value={problem.pass_count}
                    onChange={(value) => handleProblemChange(index, 'pass_count', value || 0)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={6}>
                  <InputNumber
                    addonBefore="尝试"
                    min={0}
                    value={problem.attempt_count}
                    onChange={(value) => handleProblemChange(index, 'attempt_count', value || 0)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={10}>
                  <Select
                    value={problem.my_status}
                    onChange={(value) => handleProblemChange(index, 'my_status', value)}
                    style={{ width: '100%' }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        <Tag color={opt.color}>{opt.label}</Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            ))}
          </div>

          <Row gutter={16}>
            <Col>
              <Button type="primary" onClick={handleSubmit}>
                💾 保存比赛
              </Button>
            </Col>
            <Col>
              <Button
                danger
                onClick={() => editingContest && handleDelete(editingContest.id)}
                disabled={!editingContest}
              >
                🗑️ 删除比赛
              </Button>
            </Col>
          </Row>

          {statusMsg && (
            <Alert
              message={statusMsg}
              type={statusMsg.startsWith('✓') ? 'success' : 'info'}
              style={{ marginTop: 16 }}
              showIcon
            />
          )}
        </Form>
      </Card>
    </div>
  );
};

export default ContestsPage;
