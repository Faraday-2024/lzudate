exports.main = async (event = {}) => {
  return {
    success: true,
    disabled: true,
    message: 'cleanup hook is disabled; automatic post pruning is currently off.'
  };
};
