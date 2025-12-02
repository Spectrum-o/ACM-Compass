import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Form, Input, InputNumber, Checkbox, Select, Space, DatePicker,
  message, Modal, Card, Typography, Tag, Row, Col, Tabs, Divider, Alert
} from 'antd';
import {
  EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, ClearOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Dayjs } from 'dayjs';
import { problemApi } from '@/services/api';
import type { Problem, ProblemInput, UnsolvedStage } from '@/types';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface ProblemsPageProps {
  filterMode: 'all' | 'solved' | 'unsolved';
  title: string;
}

const UNSOLVED_STAGES: UnsolvedStage[] = ['未看题', '已看题无思路', '知道做法未实现'];

const ProblemsPage: React.FC<ProblemsPageProps> = ({ filterMode, title }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [solution, setSolution] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [statusMsg, setStatusMsg] = useState('');
  const [form] = Form.useForm();

  const loadProblems = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0]?.format('YYYY-MM-DD');
      const endDate = dateRange[1]?.format('YYYY-MM-DD');
      const data = await problemApi.list(filterMode, startDate, endDate);
      setProblems(data);
    } catch {
      message.error('加载题目列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterMode, dateRange]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const handleClearForm = () => {
    setEditingProblem(null);
    setSolution('');
    form.resetFields();
    form.setFieldsValue({
      solved: false,
      tags: '',
    });
    setStatusMsg('');
  };

  const handleEdit = async (record: Problem) => {
    setEditingProblem(record);
    try {
      const solutionContent = await problemApi.getSolution(record.id);
      setSolution(solutionContent || '');
    } catch {
      setSolution('');
    }
    form.setFieldsValue({
      ...record,
      tags: record.tags?.join(', ') || '',
      link: record.link || '',
      source: record.source || '',
      assignee: record.assignee || '',
      notes: record.notes || '',
      unsolved_custom_label: record.unsolved_custom_label || '',
    });
    setStatusMsg(`已加载题目: ${record.title}`);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个题目吗？相关的题解也会被删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await problemApi.delete(id);
          message.success('删除成功');
          if (editingProblem?.id === id) {
            handleClearForm();
          }
          loadProblems();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const tagList = values.tags
        ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

      const data: ProblemInput = {
        title: values.title.trim(),
        link: values.link?.trim() || null,
        source: values.source?.trim() || null,
        tags: tagList,
        assignee: values.assignee?.trim() || null,
        solved: values.solved || false,
        unsolved_stage: values.solved ? null : values.unsolved_stage || null,
        unsolved_custom_label: values.solved ? null : values.unsolved_custom_label?.trim() || null,
        pass_count: values.pass_count ?? null,
        notes: values.notes?.trim() || null,
      };

      if (editingProblem) {
        await problemApi.update(editingProblem.id, data);
        if (solution.trim()) {
          await problemApi.saveSolution(editingProblem.id, solution.trim());
        } else {
          await problemApi.deleteSolution(editingProblem.id);
        }
        setStatusMsg(`✓ 已更新题目: ${values.title}`);
        message.success('更新成功');
      } else {
        const created = await problemApi.create(data);
        if (solution.trim()) {
          await problemApi.saveSolution(created.id, solution.trim());
        }
        setStatusMsg(`✓ 已添加题目: ${values.title}`);
        message.success('添加成功');
      }

      handleClearForm();
      loadProblems();
    } catch {
      message.error('保存失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
      render: (text: string, record: Problem) => (
        <a onClick={() => handleEdit(record)} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text.slice(0, 8)}...
        </a>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Problem) => (
        <a onClick={() => handleEdit(record)}>{text}</a>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'solved',
      key: 'solved',
      width: 100,
      render: (solved: boolean) => (
        <Tag color={solved ? 'success' : 'warning'}>
          {solved ? '✓ 已解决' : '⚠ 未解决'}
        </Tag>
      ),
    },
    {
      title: '阶段',
      dataIndex: 'unsolved_stage',
      key: 'unsolved_stage',
      width: 130,
      render: (stage: string) => stage || '-',
    },
    {
      title: '补题人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: string[]) =>
        tags?.length > 0 ? (
          <Space wrap size={[0, 4]}>
            {tags.map((tag) => (
              <Tag key={tag} color="blue">{tag}</Tag>
            ))}
          </Space>
        ) : '-',
    },
    {
      title: '通过人数',
      dataIndex: 'pass_count',
      key: 'pass_count',
      width: 100,
      render: (count: number | null) => count ?? '-',
    },
    {
      title: '题解',
      dataIndex: 'has_solution',
      key: 'has_solution',
      width: 80,
      render: (hasSolution: boolean) => (
        hasSolution ? <Tag color="green">有</Tag> : <Tag>无</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Problem) => (
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
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>{title}</Title>
          </Col>
          <Col>
            <Space>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                placeholder={['开始日期', '结束日期']}
              />
              <Button icon={<SearchOutlined />} onClick={loadProblems}>
                筛选
              </Button>
              <Button icon={<ClearOutlined />} onClick={() => setDateRange([null, null])}>
                清除日期
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadProblems}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        <Text type="secondary">点击表格中的题目ID或标题可快速加载到编辑表单</Text>

        <Table
          columns={columns}
          dataSource={problems}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1200 }}
          style={{ marginTop: 8 }}
        />

        <Divider />

        {/* 编辑表单区域 */}
        <Title level={4}>新增 / 编辑题目</Title>
        <Text type="secondary">点击表格中的题目ID或标题可快速加载到编辑表单</Text>

        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="题目ID（自动生成，编辑时自动填充）">
                <Input
                  value={editingProblem?.id || ''}
                  disabled
                  placeholder="新建题目时自动生成"
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
                name="title"
                label="* 标题"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="CF1234A - Example Problem" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="link" label="链接">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="source" label="来源">
                <Input placeholder="Codeforces / AtCoder / Luogu" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assignee" label="补题人">
                <Input placeholder="负责跟进的队员" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pass_count" label="通过人数">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="场上通过人数" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input placeholder="dp, graph, 数学" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="solved" valuePropName="checked" label=" ">
                <Checkbox>已解决</Checkbox>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="unsolved_stage" label="未解决阶段">
                <Select placeholder="选择阶段" allowClear>
                  {UNSOLVED_STAGES.map((stage) => (
                    <Select.Option key={stage} value={stage}>{stage}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="unsolved_custom_label" label="自定义标签">
                <Input placeholder="例如：卡在调试" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="记录思路、坑点等" />
          </Form.Item>

          <Title level={5}>题解（Markdown + LaTeX 支持）</Title>
          <Text type="secondary">行内公式：$公式$ | 块级公式：$$公式$$</Text>

          <Tabs
            style={{ marginTop: 8 }}
            items={[
              {
                key: 'edit',
                label: '编辑',
                children: (
                  <TextArea
                    rows={10}
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder="支持 Markdown 和 LaTeX 公式&#10;例如：&#10;行内公式 $E=mc^2$ 和 $O(n\log n)$&#10;&#10;块级公式：&#10;$$&#10;\sum_{i=1}^{n} i = \frac{n(n+1)}{2}&#10;$$"
                  />
                ),
              },
              {
                key: 'preview',
                label: '预览',
                children: (
                  <Card style={{ minHeight: 200 }}>
                    {solution ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {solution}
                      </ReactMarkdown>
                    ) : (
                      <Text type="secondary">暂无题解内容</Text>
                    )}
                  </Card>
                ),
              },
            ]}
          />

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col>
              <Button type="primary" onClick={handleSubmit}>
                💾 保存题目
              </Button>
            </Col>
            <Col>
              <Button
                danger
                onClick={() => editingProblem && handleDelete(editingProblem.id)}
                disabled={!editingProblem}
              >
                🗑️ 删除题目
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

export default ProblemsPage;
