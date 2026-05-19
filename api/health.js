module.exports = async (req, res) => {
  res.json({
    status: 'OK',
    message: 'Thrift Shop API is running',
    timestamp: new Date().toISOString()
  });
};

